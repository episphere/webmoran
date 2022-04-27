import {vectorAngle, rotate, isAngleInRange, 
  isAngleBetween, angleRangeDistance, angleDistance} from "./Angles.js"
import {default as geodajs} from 'https://cdn.skypack.dev/jsgeoda@0.2.3?min'
import * as d3 from "https://cdn.skypack.dev/d3@7"


// Workaround...
// TODO: Fix Moran's I different from GeoDa. Perhaps because different z-values (why?)
export class GeoSpatial {
  static createGeoda() {
    return geodajs.New()
  }

  constructor(geoData, opts={}) {
    opts = {
      ...{
        geoda: null,
        valueData: null,
        idField: null,
      },
      ...opts
    }
    Object.assign(this, opts)


    if (this.valueData) {
      this.addFeatureProperties(geoData.features, this.valueData, this.idField)
    }
    this.data = geoData


    if (!this.geoda) {
      //this.geoda = await geodajs.New()
      throw new Error("geoda not optional due to asyncronous issue")
    }
    
    this.id = this.geoda.readGeoJSON(this.objToBuffer(this.data))
    this.calculateWeightMatrix()
  }

  addFeatureProperties(features, propertyRows, idField) {
    const rowMap = new Map(propertyRows.map(d => [d[idField], d]))
    features.forEach(feature => {
      const row = rowMap.get(feature.id)
      if (row) {
        for (const [k, v] of Object.entries(row)) {
          feature.properties[k] = v
        }
      }
    })
    return features
  }

  objToBuffer(obj) {
    return new TextEncoder().encode(JSON.stringify(obj)).buffer
  }

  calculateWeightMatrix() {
    const weightResult = this.geoda.getRookWeights(this.id)
    this.w = weightResult

    let n = 0
    const map = new Map()


    for (const [i, feature] of this.data.features.entries()) {
      const neighbors = this.geoda.getNeighbors(weightResult, i)
      const rowMap = new Map()
      for (const neighborIndex of neighbors) {
        const neighbor = this.data.features[neighborIndex]
        rowMap.set(neighbor.id, 1/neighbors.length)
        n++
      }
      map.set(feature.id, rowMap)
    }

    this.weightMatrix = {
      size: n,
      map: map,
      nRows: this.data.features.length,
      nCols: this.data.features.length,
      get: function (i, j) {
        const rowMap = map.get(i)
        if (i < this.nRows && i >= 0 && j < this.nCols && j >= 0) {
          return rowMap.has(j) ? rowMap.get(j) : 0
        } else {
          return undefined 
        }
      },
      getRow: function(i) {
        return map.get(i)
      },
      all: function() {
        return d3.merge([...map.values()].map(d => d.values()))
      }
    }
  }

  // TODO: Check I am handling missing results right for m2 (etc.)
  // Will probably be slightly off.
  moran(vField) {
    // I think jsgeoda has High-Low and Low-High backwards, so don't rely on the labels.
    const labels = ["Not significant", "High-High", "Low-Low", "Low-High", "High-Low"]

    const validIndices = new Set()
    const validFeatures = this.data.features.filter((feature,i) => {
      const value = feature.properties[vField]
      const valid = value != null && !isNaN(value) && typeof value == "number"
      if (valid) {
        validIndices.add(i)

      }
      return valid
    })
    const validFeatureMap = new Map(validFeatures.map(d => [d.id, d]))

    const values = validFeatures.map(d => d.properties[vField])
    const ids = validFeatures.map(d => d.id)

    let permResults = []
    for (let i = 0; i < 999; i++) {
      permResults.push(this.moranLite(d3.shuffle(values), ids))
    }    
    permResults = d3.sort(permResults)

    const mean = d3.mean(validFeatures, d => d.properties[vField])

    // TODO: Probably breaks when there are invalid features. FIX! 
    //const geodaResult = this.geoda.localMoran(this.w, validFeatures.map(d => d.properties[vField]))
    const geodaResult = this.geoda.localMoran(this.w, 
      this.data.features.map(d => d.properties[vField] != null ? d.properties[vField] : NaN))
    
    for (const ret of ["clusters", "lisaValues", "neighbors", "pvalues"]) {
      geodaResult[ret] = geodaResult[ret].filter((d,i) => validIndices.has(i))
    }    

    for (let [i, validFeature] of validFeatures.entries()) {
      validFeature.properties.label = labels[geodaResult.clusters[i]]
      validFeature.properties.p = geodaResult.pvalues[i]

      let pCutoff = null
      const pCutoffs = [0.0001, 0.001, 0.01, 0.05]
      for (const d of pCutoffs) {
        if (validFeature.properties.p <= d) {
          pCutoff = d
          break
        }
      }

      validFeature.properties.pCutoff = pCutoff
    }

    const localResults = []
    let m2 = 0 
    for (let [i, validFeature] of validFeatures.entries()) {
      const z = validFeature.properties[vField] - mean

      m2 += z**2
      
      const neighbors = []
      let lag = 0
      const weightRow = this.weightMatrix.getRow(validFeature.id)
      for (const [neighborId, w] of weightRow.entries()) {
        const neighborValue = validFeatureMap.get(neighborId)
        if (neighborValue != null) {
          const neighborZ = neighborValue.properties[vField] - mean
          lag += w*neighborZ
          neighbors.push({
            id: neighborId, 
            z: neighborZ, 
            w: w,
            raw: neighborValue.properties[vField],
            label: neighborValue.properties.label,
            pCutoff: neighborValue.properties.pCutoff,
          })
        }
      }

      localResults.push({id: 
        validFeature.id, 
        z: z, 
        lag: lag, 
        raw: validFeature.properties[vField],
        neighbors: neighbors,
        cluster: geodaResult.clusters[i],
        label: labels[geodaResult.clusters[i]],
        color: geodaResult.colors[geodaResult.clusters[i]],// TODO: Remove,
        pValue: geodaResult.pvalues[i],
        pCutoff: validFeature.properties.pCutoff,
        refLisa: geodaResult.lisaValues[i]
      })
    }


    //m2 = m2 / validFeatures.length

    let globalMoran = 0
    for (const localResult of localResults) {
      localResult.localMoran = localResult.z * localResult.lag / m2
      globalMoran += localResult.localMoran
    }

    for (const [i, localResult] of localResults.entries()) { 
      const feature = validFeatures[i]
      feature.properties.localMoran = localResult.localMoran
    }

    const resultMap = new Map(localResults.map(d => [d.id, d]))
    for (const localResult of localResults) {
      for (const neighbor of localResult.neighbors) {
        neighbor.localMoran = resultMap.get(neighbor.id).localMoran
      }
    }

    let nGreater = 0
    for (let i = 0; i < permResults.length; i++) {
      if (globalMoran < permResults[permResults.length-i]) {
        nGreater = i
        break
      }
    }

    return {globalMoran: globalMoran, p: (nGreater+1)/(permResults.length+1), localMorans: localResults}
  }

  moranLite(values, ids) {
    const idToIndex = new Map(ids.map((d, i) => [d, i]))

    const localMorans = []

    const mean = d3.mean(values)
    let m2 = 0 
    for (let i = 0; i < values.length; i++) {
      const z = values[i] - mean  
      m2 += z**2
      const weightRow = this.weightMatrix.getRow(ids[i])
      let lag = 0
      for (const [neighborId, w] of weightRow.entries()) {
        const neighborValue = values[idToIndex.get(neighborId)]
        const neighborZ = neighborValue - mean
        lag += w*neighborZ
      }
      localMorans.push(z * lag)
    }

    let globalMoran = 0
    localMorans.forEach((d, i) => {
      localMorans[i] /= m2
      globalMoran += localMorans[i]
    })

    return globalMoran
  }

  localMoranRadials(moranResult) {
    const centroidMap = new Map(this.geoda.getCentroids(this.id).map((d,i) => 
      [this.data.features[i].id, d]))

    const radialMap = new Map()
    for (const localMoran of moranResult.localMorans) {
      // We need the weight / z pairs (localMoran.neighbors).
      // And the target angles for rotation. 

      for (const neighbor of localMoran.neighbors) {
        const c1 = centroidMap.get(localMoran.id)
        const c2 = centroidMap.get(neighbor.id)
        const v = [c2[0] - c1[0], c2[1] - c1[1]]
        const angle = vectorAngle(v)

        // Rotate 90 degrees. This is to match up with d3's arc function,
        //  which counts angle clockwise from 12 o'clock.
        neighbor.angle = rotate(angle, (1/2)*Math.PI)
      }

      const pie = d3.pie()
        .sort((a,b) => a.angle - b.angle)
        .value(d => d.w)
        .padAngle(0.05)
      const segments = pie(localMoran.neighbors)

      const theta = this.simpleSegmentMatch(segments)
      radialMap.set(localMoran.id, {rotateAngle: theta, segments: segments})
    }

    return radialMap
  }

  simpleSegmentMatch(segments, N = 8) {
    const step = Math.PI*2 / N

    let theta = 0
    let minDistance = Infinity
    
    for (let i = 0; i < N; i++) {
      const testTheta = i*step
      const ranges = segments.map(d => [
        rotate(d.startAngle, testTheta),
        rotate(d.endAngle, testTheta)
      ])
      const distances = segments.map((d, j) => angleRangeDistance(d.data.angle, ranges[j]))
      const distance = d3.sum(distances)
      if (distance < minDistance) {
        theta = testTheta
        minDistance = distance
      }
    }

    return theta
  }
}
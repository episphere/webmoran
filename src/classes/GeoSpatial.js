import {vectorAngle, rotate, isAngleInRange, 
  isAngleBetween, angleRangeDistance, angleDistance} from "./Angles.js"
import {default as geodajs} from 'https://cdn.skypack.dev/jsgeoda@0.2.3?min'
import * as d3 from "https://cdn.skypack.dev/d3@7"

const moranWorker = new Worker("/webmoran/src/moranWorker.js", { type: "module" })

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
        weightMap: null,
        neighborMethod: "Rook",
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

    if (this.weightMap) {
      this.weightMatrix = this.rowMapToMatrix(this.weightMap)
    } else {
      this.calculateWeightMatrix(this.neighborMethod)
    }
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

  calculateWeightMatrix(method) {
    let weightResult = null
    if (method == "Rook") {
      weightResult = this.geoda.getRookWeights(this.id)
    } else if (method == "Queen") {
      weightResult = this.geoda.getQueenWeights(this.id)
    }
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

    this.weightMatrix = this.rowMapToMatrix(map)
  }

  rowMapToMatrix(map) {
    return {
      map: map,
      nRows: map.size,
      nCols: map.size,
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
  moran(vField, callback) {
    // I think jsgeoda has High-Low and Low-High backwards, so don't rely on the labels.
    //const labels = ["Not significant", "High-High", "Low-Low", "Low-High", "High-Low"]


    moranWorker.postMessage({data: this.data, weightMatrix: this.weightMatrix.map, vField: vField})
    moranWorker.addEventListener("message", function(e) {
      callback(e.data)
    })

    // const validIndices = new Set()
    // const validFeatures = this.data.features.filter((feature,i) => {
    //   const value = feature.properties[vField]
    //   const valid = value != null && !isNaN(value) && typeof value == "number"
    //   if (valid) {
    //     validIndices.add(i)

    //   }
    //   return valid
    // })
    // const validFeatureMap = new Map(validFeatures.map(d => [d.id, d]))

    // const values = validFeatures.map(d => d.properties[vField])
    // const ids = validFeatures.map(d => d.id)

    // let permResults = []
    // for (let i = 0; i < 999; i++) {
    //   permResults.push(this.moranLite(d3.shuffle(values), ids))
    // }    

    // const mean = d3.mean(validFeatures, d => d.properties[vField])
    // const deviation = d3.deviation(validFeatures, d => d.properties[vField])

    // const localResults = []
    // let m2 = 0 
    // for (let [i, validFeature] of validFeatures.entries()) {
    //   const z = (validFeature.properties[vField] - mean)/deviation

    //   m2 += z**2
      
    //   const neighbors = []
    //   let lag = 0
    //   const weightRow = this.weightMatrix.getRow(validFeature.id)
    //   for (const [neighborId, w] of weightRow.entries()) {
    //     const neighborValue = validFeatureMap.get(neighborId)
    //     if (neighborValue != null) {
    //       const neighborZ = (neighborValue.properties[vField] - mean) / deviation
    //       lag += w*neighborZ
    //       neighbors.push({
    //         id: neighborId, 
    //         z: neighborZ, 
    //         w: w,
    //         raw: neighborValue.properties[vField],
    //         label: neighborValue.properties.label,
    //         pCutoff: neighborValue.properties.pCutoff,
    //       })
    //     }
    //   }

    //   localResults.push({id: 
    //     validFeature.id, 
    //     z: z, 
    //     lag: lag, 
    //     raw: validFeature.properties[vField],
    //     neighbors: neighbors,
    //     pCutoff: validFeature.properties.pCutoff
    //   })
    // }

    // let globalMoran = 0
    // for (const localResult of localResults) {

    //   localResult.localMoran = localResult.z * localResult.lag / m2
    //   globalMoran += localResult.localMoran

    // }

    // const permutes = 999 // TODO: Set to 999

    // // P Values
    // const zValues = localResults.map(d => d.z)
    // for (const [i, localResult] of localResults.entries()) {
    //   if (this.progressElement) {
    //     this.progressElement.textContent = `${i+1}/${localResults.length} areas.`
    //   }

    //   const zValuesCopy = [...zValues]
    //   zValuesCopy.splice(i, 1)
    //   const weights = localResult.neighbors.map(d => d.w)

    //   const Iis = []
    //   for (let j = 0; j < permutes; j++) {
    //     d3.shuffle(zValuesCopy)
    //     const neighborZs = zValuesCopy.slice(0, localResult.neighbors.length)
    //     Iis.push(this.localMoranLite(localResult.z, neighborZs, weights))
    //   }

    //   const actualIi = this.localMoranLite(localResult.z, localResult.neighbors.map(d => d.z), weights)
    //   const refIis = Iis.filter(actualIi >= 0 ? d => d > 0 : d => d < 0).map(d => Math.abs(d))
    //   refIis.sort((a, b) => a - b)

    //   let minIndex = refIis.length
    //   for (let j = 0; j < refIis.length; j++) {
    //     if (Math.abs(actualIi) > refIis[refIis.length-j-1]) {
    //       minIndex = j
    //       break
    //     }
    //   }

    //   localResult.p = (minIndex + 1) / (permutes + 1)
    //   if (localResult.p < 0.05) {
    //     let label = ""
    //     label = label + (localResult.z >= 0 ? "High" : "Low")
    //     label = label + (localResult.lag >= 0 ? "-High" : "-Low")
    //     localResult.label = label
    //   } else {
    //     localResult.label = "Not significant"
    //   }
    // }

    // for (let [i, validFeature] of validFeatures.entries()) {
    //   validFeature.properties.label = localResults[i].label//labels[geodaResult.clusters[i]]
    //   validFeature.properties.p = localResults[i].p//geodaResult.pvalues[i]

    //   let pCutoff = null
    //   const pCutoffs = [0.0001, 0.001, 0.01, 0.05]
    //   for (const d of pCutoffs) {
    //     if (validFeature.properties.p <= d) {
    //       pCutoff = d
    //       break
    //     }
    //   }

    //   localResults[i].pCutoff = pCutoff
    //   validFeature.properties.pCutoff = pCutoff
    // }

    // for (const [i, localResult] of localResults.entries()) { 
    //   const feature = validFeatures[i]
    //   feature.properties.localMoran = localResult.localMoran
    // }

    // const resultMap = new Map(localResults.map(d => [d.id, d]))
    // for (const localResult of localResults) {
    //   for (const neighbor of localResult.neighbors) {
    //     const res = resultMap.get(neighbor.id)
    //     neighbor.localMoran = res.localMoran
    //     neighbor.pCutoff = res.pCutoff
    //     neighbor.label = res.label
    //   }
    // }

    // let permResFixed = permResults.map(d => Math.abs(d))
    // permResFixed = d3.sort(permResFixed)
    // let nGreater = 0
    // for (let i = 1; i < permResults.length; i++) {
    //   if (Math.abs(globalMoran) < permResults[permResults.length-i-1]) {
    //     nGreater = i
    //     break
    //   }
    // }

    // return {globalMoran: globalMoran, p: (nGreater+1)/(permResults.length+1), localMorans: localResults}
    
  }

  moranLite(values, ids) {
    const idToIndex = new Map(ids.map((d, i) => [d, i]))

    const localMorans = []

    const mean = d3.mean(values)
    const deviation = d3.deviation(values)

    let m2 = 0 
    for (let i = 0; i < values.length; i++) {
      const z = (values[i] - mean) / deviation
      m2 += z**2
      const weightRow = this.weightMatrix.getRow(ids[i])
      let lag = 0
      for (const [neighborId, w] of weightRow.entries()) {
        const neighborValue = values[idToIndex.get(neighborId)]
        const neighborZ = (neighborValue - mean) /deviation
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

  localMoranLite(z, neighborZs, weights) {
    let lag = 0
    for (let i = 0; i < weights.length; i++) {
      lag += neighborZs[i] * weights[i]
    }
    return z * lag 
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
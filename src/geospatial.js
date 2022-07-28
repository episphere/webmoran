
import * as toposerver from 'https://unpkg.com/topojson-server@3.0.1/src/index.js?module'
import * as topojson from 'https://unpkg.com/topojson-client@3.1.0/src/index.js?module'

export function calculateWeightMatrix(geoJson, method="Queen") {
  const topology = toposerver.topology(geoJson.features)
  const objects = [...Object.values(topology.objects)]
  
  let neighbors = []
  if (method == "Rook") {
    neighbors = topojson.neighbors(objects)
  } else if (method == "Queen") {
    // TODO: Implement
  }

  const weightMatrix = new Map()
  for (let i = 0; i < neighbors.length; i++) {
    const matrixRow = new Map()
    neighbors[i].forEach(neighbor => matrixRow.set(objects[neighbor].id, 1/neighbors[i].length))
    weightMatrix.set(objects[i].id, matrixRow)
  }

  weightMatrix.retrieve = (i, j=null) => {
    if (j == null) {
      return weightMatrix.get(i)
    } else {
      return weightMatrix.get(i).get(j)
    }
  }

  return weightMatrix
}

export async function calculateMoran(features, vField, weightMatrix, opts={}) {
  opts = {
    permutations: 0, 
    progressCallback: d => d,
    ...opts 
  }

  const validFeatures = features.filter(feature => isNumber(feature.properties[vField]))

  const mean = d3.mean(validFeatures, d => d.properties[vField])
  const deviation = d3.deviation(validFeatures, d => d.properties[vField])

  const localResults = []
  for (let feature of validFeatures) {
    localResults.push({
      //properties: feature.properties, 
      id: feature.id,
      z: (feature.properties[vField] - mean)/deviation ,
      [vField]: feature.properties[vField]
    })
  }

  const localResultMap = new Map(localResults.map(d => [d.id, d]))

  let m2 = 0
  for (let localResult of localResults) {
    const weightRow = weightMatrix.get(localResult.id)
    
    let lag = 0
    const neighbors = []
    for (const [neighborId, w] of weightRow.entries()) {
      const neighborResult = localResultMap.get(neighborId)
      lag += w*neighborResult.z
      neighbors.push({
        w: w,
        localMoran: neighborResult
      })
    }

    localResult.lag = lag
    localResult.neighbors = neighbors
    m2 += localResult.z**2
  }

  let globalMoran = 0
  for (const localResult of localResults) {
    localResult.localMoran = localResult.z * localResult.lag / m2
    globalMoran += localResult.localMoran
  }

  const moranResult = {
    globalMoran: globalMoran, 
    localMorans: localResults
  }

  if (opts.permutations) {
    await calculatePValues(localResults, opts.permutations)
  }

  return moranResult
}

export async function calculatePValues(moranResult, permutations) {
  const localResults = moranResult.localMorans
  const zValues = localResults.map(d => d.z)
  localResults.forEach((localResult, i) => {
    const zValuesCopy = [...zValues]
    zValuesCopy.splice(i, 1)
    const weights = localResult.neighbors.map(d => d.w)

    const Iis = []
    for (let j = 0; j < permutations; j++) {
      d3.shuffle(zValuesCopy)
      const neighborZs = zValuesCopy.slice(0, localResult.neighbors.length)
      Iis.push(localMoranLite(localResult.z, neighborZs, weights))
    }

    const actualIi = localMoranLite(localResult.z, 
      localResult.neighbors.map(d => d.localMoran.z), weights)
    const refIis = Iis.filter(actualIi >= 0 ? d => d > 0 : d => d < 0).map(d => Math.abs(d))
    refIis.sort((a, b) => a - b)

    let minIndex = refIis.length
    for (let j = 0; j < refIis.length; j++) {
      if (Math.abs(actualIi) > refIis[refIis.length-j-1]) {
        minIndex = j
        break
      }
    }

    localResult.p = (minIndex + 1) / (permutations + 1)
    if (localResult.p < 0.05) {
      let label = ""
      label = label + (localResult.z >= 0 ? "High" : "Low")
      label = label + (localResult.lag >= 0 ? "-High" : "-Low")
      localResult.label = label
    } else {
      localResult.label = "Not significant"
    }
  })
  return localResults
}

function localMoranLite(z, neighborZs, weights) {
  let lag = 0
  for (let i = 0; i < weights.length; i++) {
    lag += neighborZs[i] * weights[i]
  }
  return z * lag 
}


function isNumber(n){
  return typeof n == 'number' && !isNaN(n) && isFinite(n)
}

function featuresToMoranRows(features, dataMatrix=null) {

}
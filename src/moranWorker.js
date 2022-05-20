import * as d3 from "https://cdn.skypack.dev/d3@7"

self.addEventListener("message", function(e) {

  const {data, vField, weightMatrix} = {...e.data}

  const validIndices = new Set()
  const validFeatures = data.features.filter((feature,i) => {
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
    permResults.push(moranLite(d3.shuffle(values), ids, weightMatrix))
  }    

  const mean = d3.mean(validFeatures, d => d.properties[vField])
  const deviation = d3.deviation(validFeatures, d => d.properties[vField])

  const localResults = []
  let m2 = 0 
  for (let [i, validFeature] of validFeatures.entries()) {
    const z = (validFeature.properties[vField] - mean)/deviation

    m2 += z**2
    
    const neighbors = []
    let lag = 0
    const weightRow = weightMatrix.get(validFeature.id)
    for (const [neighborId, w] of weightRow.entries()) {
      const neighborValue = validFeatureMap.get(neighborId)
      if (neighborValue != null) {
        const neighborZ = (neighborValue.properties[vField] - mean) / deviation
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
      pCutoff: validFeature.properties.pCutoff
    })
  }

  let globalMoran = 0
  for (const localResult of localResults) {

    localResult.localMoran = localResult.z * localResult.lag / m2
    globalMoran += localResult.localMoran

  }

  const permutes = 999 // TODO: Set to 999

  // P Values
  const zValues = localResults.map(d => d.z)
  for (const [i, localResult] of localResults.entries()) {

    const zValuesCopy = [...zValues]
    zValuesCopy.splice(i, 1)
    const weights = localResult.neighbors.map(d => d.w)

    const Iis = []
    for (let j = 0; j < permutes; j++) {
      d3.shuffle(zValuesCopy)
      const neighborZs = zValuesCopy.slice(0, localResult.neighbors.length)
      Iis.push(localMoranLite(localResult.z, neighborZs, weights))
    }

    const actualIi = localMoranLite(localResult.z, localResult.neighbors.map(d => d.z), weights)
    const refIis = Iis.filter(actualIi >= 0 ? d => d > 0 : d => d < 0).map(d => Math.abs(d))
    refIis.sort((a, b) => a - b)

    let minIndex = refIis.length
    for (let j = 0; j < refIis.length; j++) {
      if (Math.abs(actualIi) > refIis[refIis.length-j-1]) {
        minIndex = j
        break
      }
    }

    localResult.p = (minIndex + 1) / (permutes + 1)
    if (localResult.p < 0.05) {
      let label = ""
      label = label + (localResult.z >= 0 ? "High" : "Low")
      label = label + (localResult.lag >= 0 ? "-High" : "-Low")
      localResult.label = label
    } else {
      localResult.label = "Not significant"
    }

    self.postMessage({progress: (i+1)/localResults.length, done: false})
  }

  for (let [i, validFeature] of validFeatures.entries()) {
    validFeature.properties.label = localResults[i].label
    validFeature.properties.p = localResults[i].p

    let pCutoff = null
    const pCutoffs = [0.0001, 0.001, 0.01, 0.05]
    for (const d of pCutoffs) {
      if (validFeature.properties.p <= d) {
        pCutoff = d
        break
      }
    }

    localResults[i].pCutoff = pCutoff
    validFeature.properties.pCutoff = pCutoff
  }

  for (const [i, localResult] of localResults.entries()) { 
    const feature = validFeatures[i]
    feature.properties.localMoran = localResult.localMoran
  }

  const resultMap = new Map(localResults.map(d => [d.id, d]))
  for (const localResult of localResults) {
    for (const neighbor of localResult.neighbors) {
      const res = resultMap.get(neighbor.id)
      neighbor.localMoran = res.localMoran
      neighbor.pCutoff = res.pCutoff
      neighbor.label = res.label
    }
  }

  let permResFixed = permResults.map(d => Math.abs(d))
  permResFixed = d3.sort(permResFixed)
  let nGreater = 0
  for (let i = 1; i < permResults.length; i++) {
    if (Math.abs(globalMoran) < permResults[permResults.length-i-1]) {
      nGreater = i
      break
    }
  }

  const moranResult =  {
    globalMoran: globalMoran, 
    p: (nGreater+1)/(permResults.length+1), 
    localMorans: localResults
  }

  self.postMessage({data: data, moranResult: moranResult, done: true})

})

function moranLite(values, ids, weightMatrix) {
  const idToIndex = new Map(ids.map((d, i) => [d, i]))

  const localMorans = []

  const mean = d3.mean(values)
  const deviation = d3.deviation(values)

  let m2 = 0 
  for (let i = 0; i < values.length; i++) {
    const z = (values[i] - mean) / deviation
    m2 += z**2
    const weightRow = weightMatrix.get(ids[i])
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

function localMoranLite(z, neighborZs, weights) {
  let lag = 0
  for (let i = 0; i < weights.length; i++) {
    lag += neighborZs[i] * weights[i]
  }
  return z * lag 
}
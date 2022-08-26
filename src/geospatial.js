
import * as toposerver from 'https://unpkg.com/topojson-server@3.0.1/src/index.js?module'
import * as topojson from 'https://unpkg.com/topojson-client@3.1.0/src/index.js?module'
import * as d3 from "https://cdn.skypack.dev/d3@7"
import {vectorAngle, rotate, isAngleInRange, 
  isAngleBetween, angleRangeDistance, angleDistance} from "./classes/Angles.js"

// TODO: Test p-values (esp. global)

export function 
calculateWeightMatrix(geoJson, method="Queen") {
  const topology = toposerver.topology(geoJson.features)
  const objects = [...Object.values(topology.objects)]
  
  let neighbors = []
  if (method == "Rook") {
    neighbors = topojson.neighbors(objects)
  } else if (method == "Queen") {
    neighbors = getNeighborsPoint(objects, topology)
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
  localResults.forEach((localResult, i) => {

    const weightRow = weightMatrix.get(localResult.id)
    
    let lag = 0
    const neighbors = []
    for (const [neighborId, w] of weightRow.entries()) {
      const neighborResult = localResultMap.get(neighborId)
      if (neighborResult) {
        lag += w*neighborResult.z
      }
      
      neighbors.push({
        w: w,
        //localMoran: neighborResult
        id: neighborId,
      })
    }

    localResult.lag = lag
    localResult.neighbors = neighbors
    m2 += localResult.z**2
  })

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
    await calculatePValues(localResults, weightMatrix, {permutations: opts.permutations})
  }

  return moranResult
}

export async function calculatePValues(moranResult, weightMatrix, opts={}) {
  opts = {
    progressCallback: d => d,
    permutations: 999,
    ...opts
  }

  const progressCallback = opts.progressCallback
  const permutations = opts.permutations

  // Calculate local moran p-values
  const localResults = moranResult.localMorans
  const localResultMap = new Map(localResults.map(d => [d.id, d]))
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

    const neighbors = localResult.neighbors.map(d => localResultMap.get(d.id))
      .filter(d => d)

    const actualIi = localMoranLite(localResult.z, 
      neighbors.map(d => d.z), weights)
    const refIis = Iis.filter(actualIi >= 0 ? d => d > 0 : d => d < 0).map(d => Math.abs(d))
    refIis.sort((a, b) => b - a)
    let minIndex = refIis.findIndex(d => Math.abs(actualIi) > d)


    localResult.p = (minIndex + 1) / (permutations + 1)
    if (localResult.p < 0.05) {
      let label = ""
      label = label + (localResult.z >= 0 ? "High" : "Low")
      label = label + (localResult.lag >= 0 ? "-High" : "-Low")
      localResult.label = label
    } else {
      localResult.label = "Not significant"
    }

    localResult.pCutoff = [0.0001, 0.001, 0.01, 0.05].find(d => localResult.p < d)
    
    if (i % 50 == 0) progressCallback(i/localResults.length)
  })

  // Calculate global moran p-values
  //const globalMoran = localResults.map

  const zs = localResults.map(d => d.z)
  const ids = localResults.map(d => d.id)
  let permMorans = []
  for (let i = 0; i < permutations; i++) {
    permMorans.push(moranLite(d3.shuffle(zs), ids, weightMatrix))
  }
  
  permMorans = permMorans.map(d => Math.abs(d))
  permMorans.sort((a, b) => b - a)
  let nGreater = permMorans.findIndex(d => Math.abs(moranResult.globalMoran) > d)

  moranResult.p = (nGreater+1) / (permMorans.length +1)
  
  progressCallback(1)
  return moranResult//localResults
}

export function localMoranRadials(moranResult, centroidMap) {
  const radialMap = new Map()
  const localResultMap = new Map(moranResult.localMorans.map(d => [d.id, d]))
  for (const localMoran of moranResult.localMorans) {
    // We need the weight / z pairs (localMoran.neighbors).
    // And the target angles for rotation. 

    for (let neighbor of localMoran.neighbors) {

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

    const theta = simpleSegmentMatch(segments)
    radialMap.set(localMoran.id, {rotateAngle: theta, segments: segments})
  }

  return radialMap
}

function simpleSegmentMatch(segments, N = 8) {
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

function moranLite(zs, ids, weightMatrix) {  
  const idToIndex = new Map(ids.map((d, i) => [d, i]))

  let globalMoran = 0
  let m2 = 0
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i]
    m2 += z**2
    let lag = 0
    for (const [neighborId, w] of weightMatrix.get(ids[i])) {
      const neighborZ = zs[idToIndex.get(neighborId)]
      lag += w*neighborZ
    }
    globalMoran += z*lag
  }

  return globalMoran / m2
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

// Queen neighbors

function getNeighborsPoint(topoObj, topology) {
  const allArcs = topoObj.map(d => decodeArcs(d, topology))
  const allPoints = allArcs.map(d => uniqueArray2D(d3.merge(d)))
  const allPointsMerged = d3.merge(allPoints)

  const xRange = d3.extent(allPointsMerged, d => d[0])
  const yRange = d3.extent(allPointsMerged, d => d[1])

  const xFactor = xRange[1] - xRange[0]
  const yFactor = yRange[1] - yRange[0]

  const gridN = 1000 // This needs to be balanced for performance. 
  const cellWidth = xFactor / gridN
  const cellHeight = yFactor / gridN

  const areaGridPoints = []
  allPoints.forEach((areaPoints, i) => {
    areaPoints.forEach(point => {
      const gridX = Math.floor(point[0] / cellWidth)
      const gridY = Math.floor(point[1] / cellHeight)
      const gridKey = `${gridX}-${gridY}`
      areaGridPoints.push({key: gridKey, gridX: gridX, gridY: gridY, point: point, area: i})
    })
  })

  const checkDistance = (xFactor > yFactor ? xFactor : yFactor) / 10000 

  const areaGridMap = d3.group(areaGridPoints, d => d.key)

  const queenNeighbors = []
  const areaQueenNeighbors = allArcs.map(() => new Set()) 
  areaGridPoints.forEach((gridPoint, i) => {

    const neighbors = []
    let contenders = [...areaGridMap.get(gridPoint.key)]

    const distanceToLeftGrid = gridPoint.point[0] - gridPoint.gridX * cellWidth
    const distanceToRightGrid = (gridPoint.gridX+1) * cellWidth - gridPoint.point[0]
    if (distanceToLeftGrid < checkDistance) {
      const adjKey = `${gridPoint.gridX-1}-${gridPoint.gridY}`
      const addContenders = areaGridMap.get(adjKey)
      if (addContenders) addContenders.forEach(gridPoint => contenders.push(gridPoint))
    } else if (distanceToRightGrid  < checkDistance) {
      const adjKey = `${gridPoint.gridX+1}-${gridPoint.gridY}`
      const addContenders = areaGridMap.get(adjKey)
      if (addContenders) addContenders.forEach(gridPoint => contenders.push(gridPoint))
    }

    const distanceToTopGrid = gridPoint.point[1] - gridPoint.gridY * cellHeight
    const distanceToBottomGrid = (gridPoint.gridY+1) * cellHeight - gridPoint.point[1]
    if (distanceToTopGrid < checkDistance) {
      const adjKey = `${gridPoint.gridX}-${gridPoint.gridY-1}`
      const addContenders = areaGridMap.get(adjKey)
      if (addContenders) addContenders.forEach(gridPoint => contenders.push(gridPoint))
    } else if (distanceToBottomGrid  < checkDistance) {
      const adjKey = `${gridPoint.gridX}-${gridPoint.gridY+1}`
      const addContenders = areaGridMap.get(adjKey)
      if (addContenders) addContenders.forEach(gridPoint => contenders.push(gridPoint))
    }

    contenders = contenders.filter(d => d.area != gridPoint.area)
    contenders.forEach(contender => {
      if (distance(contender.point, gridPoint.point) < checkDistance) {
        neighbors.push(contender)
      }
    })

    queenNeighbors.push(neighbors)
    neighbors.forEach(neighbor => areaQueenNeighbors[gridPoint.area].add(neighbor.area))
  })
  
  return areaQueenNeighbors.map(d => [...d])
}

const arcIndex = d => d < 0 ? ~d : d

function decodeArcs(geometry, topology) {
  const arcIndices = mergeRecursive(geometry.arcs)
  const arcs = arcIndices.map(d => {
    const index = d >= 0 ? d : ~d
    const decoded = decodeArc(topology, topology.arcs[index])
    return decoded
  })
  return arcs
}

// Source: https://github.com/topojson/topojson-specification
// Modified: Doesn't consider transform (not relevant for border detection)
function decodeArc(topology, arc) {
  var x = 0, y = 0;
  return arc.map(function(position) {
    position = position.slice();
    position[0] = (x += position[0])// * topology.transform.scale[0] + topology.transform.translate[0];
    position[1] = (y += position[1])// * topology.transform.scale[1] + topology.transform.translate[1];
    return position;
  });
}

function distance(a, b) {
  return Math.sqrt(d3.sum(a.map((_, i) => (a[i]-b[i])**2)))
}

function mergeRecursive(array) {
  if (Array.isArray(array[0])) {
    return mergeRecursive(d3.merge(array))//array
  } else {
    return array
  }
}

function uniqueArray2D(arr) {
  const map = new Map()
  arr.forEach(subArr => map.set(subArr.join("-"), subArr))
  return [...map.values()]
}
import { DataMap } from "./classes/DataMap.js"
import { MoranPlot } from "./classes/MoranPlot.js"
import { GeoSpatial } from "./classes/GeoSpatial.js"
import { ColorKey } from "./classes/ColorKey.js"
import { default as geodajs } from 'https://cdn.skypack.dev/jsgeoda@0.2.3?min'


// --- ASSUMPTIONS ---
// * GeoJSON is FeatureCollection 
// * Each feature in GeoJSON has same properties

// TODO: Area name field select

let urlAddress = null
const geoDataSelectLabel = document.getElementById("geo-data-select-label")
geoDataSelectLabel.innerHTML = "None"
const rowDataSelectLabel = document.getElementById("row-data-select-label")
rowDataSelectLabel.innerHTML = "None"

const idFieldSelect = document.getElementById("idfield-select")
const vFieldSelect = document.getElementById("vfield-select")

const runButton = document.getElementById("run-button")

const colorElement = document.getElementById("plot-key")


let geoData = null
let rowData = null

let dataMap = null
let moranPlot = null
let moranResult = null

let filename = null
async function updateGeoData(data, vField = null) {
  // TODO: Smart fields. 
  geoData = data

  const fields = Object.keys(data.features[0].properties)
  fields.forEach(d => addOption(vFieldSelect, d))

  if (vField) {
    vFieldSelect.value = vField
  }
}

function updateRowData(data) {
  // TODO: Smart fields. 
  rowData = data

  const fields = Object.keys(data[0])
  fields.forEach(d => addOption(vFieldSelect, d))
  fields.forEach(d => addOption(idFieldSelect, d))
}

function shorten(str, n) {
  return str.length < n ? str : str.slice(0, n) + "..."
}

function uploadGeoFile(file) {
  const reader = new FileReader()
  function parseFile() {
    let data = null
    data = JSON.parse(reader.result)
    updateGeoData(data)
    geoDataSelectLabel.innerHTML = shorten(file.name, 15)
    filename = file.name
    urlAddress = null
  }

  reader.addEventListener("load", parseFile, false);
  if (file) {
    reader.readAsText(file)
  }
}

function uploadRowFile(file) {
  const reader = new FileReader()
  function parseFile() {
    let data = null
    data = d3.csvParse(reader.result)
    updateRowData(data)
    rowDataSelectLabel.innerHTML = shorten(file.name, 15)
    filename = file.name
    urlAddress = null
  }

  reader.addEventListener("load", parseFile, false);
  if (file) {
    reader.readAsText(file)
  }
}

function addOption(select, field) {
  const option = document.createElement("option")
  option.setAttribute("value", field)
  option.innerHTML = field
  select.appendChild(option)
}

let colorScale = null

async function runData(geoData, rowData) {
  if (rowData) {
    addFeatureProperties(geoData.features, rowData, idFieldSelect.value)
  }  
  
  // TODO: Better z-score calculation
  const vField = vFieldSelect.value 
  for (const feature of geoData.features) {
    feature.properties.feature = parseFloat(feature.properties[vField])
  }
  const mean = d3.mean(geoData.features, d => d.properties[vField])
  for (const feature of geoData.features) {
    feature.properties.z = feature.properties[vField] - mean
  }

  const valueExtent = d3.extent(geoData.features.filter(
    d => !isNaN(parseFloat(d.properties[vField]))), d => d.properties[vField])
  colorScale = d3.scaleSequential(d3.interpolateCividis)
    .domain(valueExtent)

  const geoda = await geodajs.New()
  const geoSpatial = new GeoSpatial(geoData, {geoda: geoda})
  moranResult = geoSpatial.moran(vField)
  const radialMap = geoSpatial.localMoranRadials(moranResult)

  const mapElement = document.getElementById("plot-datamap")
  dataMap = new DataMap(mapElement, geoData, vField, 
    { 
      areaName: "county",
      numberFormat: d => d.toFixed(2),colorScale: colorScale, width:400, height:400,
    })



  const moranElement = document.getElementById("plot-moran")
  moranPlot = new MoranPlot(moranElement, moranResult,
    {state: dataMap.state, numberFormat: d => d.toFixed(2), 
      fixedColorScale: colorScale, radialMap: radialMap,
      width:400, height:400, margin: {left:40, right:50, bottom:30, top:30}})
  
  new ColorKey(colorElement, colorScale, "continuous", 
    {width:90,  title: vField, margin:{left: 30, right: 40, top: 10, bottom: 10,}})
}

document.getElementById("geo-data-select").addEventListener("change", e => {
  const file = e.target.files[0]
  uploadGeoFile(file)
})

document.getElementById("row-data-select").addEventListener("change", e => {
  const file = e.target.files[0]
  uploadRowFile(file)
})

runButton.addEventListener("click", () => {
  runData(geoData, rowData)
})

d3.json("data/vi_props.json").then(d => {
  geoDataSelectLabel.innerHTML = shorten("CHR 2021.csv", 15)
  updateGeoData(d, "% Adult smoking")
  runData(d)
}) 

document.addEventListener('keydown', keyDown)

const clusterColorScale = d3.scaleOrdinal(
  ["Not significant", "High-High", "Low-Low", "Low-High", "High-Low"],
  ['#eeeeee', '#FF0000', '#0000FF', '#a7adf9', '#f4ada8'])

const mode = "default"
function keyDown(e) {
  if (e.target != document.body) {
    return
  }

  if (e.code == "KeyC") {

    const clusterColorFunction = d => {
      return clusterColorScale(d.label)
    }


    dataMap.setFillColorFunction(clusterColorFunction)
    moranPlot.setFillColorFunction(clusterColorFunction)

    

    new ColorKey(colorElement, clusterColorScale, "categorical", {width:80})
  } else if (e.code == "KeyP" ) {
    dataMap.setFillColorFunction(clusterColorFunction)
    moranPlot.setFillColorFunction(clusterColorFunction)
  } else if (e.code == "KeyV" ) {
    dataMap.setFillColorFunction(null)
    moranPlot.setFillColorFunction(null)

    new ColorKey(colorElement, colorScale, "continuous", 
      {width:80, margin:{left: 30, right: 30, top: 10, bottom: 10}})
  }
}

// -------

function addFeatureProperties(features, propertyRows, idField) {
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
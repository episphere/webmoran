import * as elem from "./elements.js"
import * as geo from "./geospatial.js"
import { DataMap } from "./classes/DataMap2.js"


// TODO: Option to maintain color scale domain across variables

const fileState = {
  geoDataMap: new Map(),
  rowDataMap: new Map(),
  weightFileMap: new Map(),
}

const configState = {
  idField: "fipscode",
  subAreaField: "state",
  area: "VA",
  vField: "adult_smoking",
}

const state = {
  geoData: null,
  rowData: null,
  plotData: null,
  fieldDetails: new Map(),
}

const plots = {
  dataMap: null,
}

const elements = {}


function changeGeoData(id, triggerChange = true) {
  //console.log("Changing geo data to:", id)  

  fileState.rowDataMap.clear()
  state.rowData = null 
  state.geoData = fileState.geoDataMap.get(id)

  elem.clearSelect(elements.rowFileSelect)
  elem.clearSelect(elements.idFieldSelect)

  if (triggerChange) {
    dataChanged()
  }
   
}

function changeRowData(id, triggerChange = false) {
  //console.log("Changing row data to:", id)

  const fields = new Set()
  for (const row of state.rowData) {
    Object.keys(row).forEach(field => fields.add(field))
  }

  const featureMap = d3.index(state.geoData.features, d => d.id)

  let potentialIdField = null
  let maxSharedValues = 0
  for (const field of fields) {
    const uniqueValues = new Set(state.rowData.map(row => row[field]))

    let sharedValues = 0 
    uniqueValues.forEach(value => {
      if (featureMap.has(value)) {
        sharedValues++
      }
    })

    if (sharedValues > maxSharedValues) {
      potentialIdField = field
      maxSharedValues = sharedValues
    }

    if (sharedValues == featureMap.size) {
      break
    }
  }

  fields.forEach(field => elem.addOption(elements.idFieldSelect, field, field == potentialIdField))

  if (triggerChange) {
    dataChanged()
  }
}

function dataChanged() {

  //console.log(state.geoData, state.rowData)

  if (state.rowData) {
    addFeatureProperties(state.geoData.features, state.rowData, elements.idFieldSelect.value)
  }

  elem.clearSelect(elements.idFieldSelect)
  elem.clearSelect(elements.subAreaFieldSelect)
  elem.clearSelect(elements.areaSelect)
  elem.clearSelect(elements.valueFieldSelect)
  state.fieldDetails.clear()

  const fields = new Set()
  for (const feature of state.geoData.features) {
    Object.keys(feature.properties).forEach(field => fields.add(field))
  }

  for (const field of fields) {
    const uniqueValues = new Set(state.geoData.features.map(feature => feature.properties[field]))
    const numericValues = state.geoData.features.filter(feature => !isNaN(feature.properties[field]))
    state.fieldDetails.set(field, {unique: uniqueValues.size, numeric: numericValues.length})
  }

  let sortedFields = [...state.fieldDetails.entries()].sort(
    (a,b) => (b[1].numeric+b[1].unique) - (a[1].numeric + a[1].unique))
  const vField = sortedFields.find(d => d[0] != elements.idFieldSelect.value)[0]

  fields.forEach(field => elem.addOption(elements.valueFieldSelect, field, field == vField))

  fields.forEach(field => elem.addOption(elements.subAreaFieldSelect, field, 
    field == configState.subAreaField))

  if (configState.subAreaField != "None") {
    const areas = new Set(state.geoData.features.map (
      feature => feature.properties[configState.subAreaField]))
    areas.forEach(area => elem.addOption(elements.areaSelect, area, area == configState.area))
  }

  setArea(elements.areaSelect.value)

  state.plotData.features.forEach(feature => 
    feature.properties[vField] = parseFloat(feature.properties[vField]))

}

function setArea(area) {
  state.plotData = area == "All" ? state.geoData : ({
    type: "FeatureCollection",
    features: state.geoData.features.filter(
      feature => feature.properties[configState.subAreaField] == area) 
  })
}

// Plot the initial data, before calculating Moran's I values
function plotBaseData() {
  const mapElement = document.getElementById("plot-datamap")
  plots.dataMap = new DataMap(mapElement, state.plotData, elements.valueFieldSelect.value, { 
       numberFormat: d => d.toFixed(3), width:400, height:400,
    })
}

function createFileConfigElement() {
  const fileConfig = document.getElementById("file-config")

  // Geo file picker
  const geoFileParser = fileParser((e, file) => {
    let data = JSON.parse(e.currentTarget.result)
    fileState.geoDataMap.set(file.name, data)
  })
  const geoChangeListener = e => {
    changeGeoData(e.target.value)
  }
  const geoFilePick = elem.createFilePick("Geography:", geoFileParser, geoChangeListener)
  geoFilePick.setAttribute("id", "geo-file-pick")
  elements.geoFileSelect = geoFilePick.getElementsByTagName("select")[0]

  // Row file picker
  const rowFileParser = fileParser((e, file) => {
    let data = d3.csvParse(e.currentTarget.result)
    //fileState.rowDataMap.set(file.name, data)
  })
  const rowChangeListener = e => {
    changeRowData(e.target.value)
  }
  const rowFilePick = elem.createFilePick("Row Data:", rowFileParser, rowChangeListener)
  rowFilePick.setAttribute("id", "row-file-pick")
  elements.rowFileSelect = rowFilePick.getElementsByTagName("select")[0]

  
  const weightFilePick = elem.createFilePick("Weights:", file => {
    // TODO: Implement weight parsing
    weightFileMap.set(file.name, "...")
  })
  elements.weightFileSelect = weightFilePick.getElementsByTagName("select")[0]
  elements.weightFileSelect.setAttribute("disabled", "")


  const idFieldSelect = elem.createSelect("ID Field:", [], "Awaiting file...")
  idFieldSelect.setAttribute("id", "id-field-select")
  elements.idFieldSelect = idFieldSelect.getElementsByTagName("select")[0]

  const subAreaFieldSelect = elem.createSelect("Sub-Area Field:", [], "None")
  subAreaFieldSelect.setAttribute("id", "sub-area-field-select")
  elements.subAreaFieldSelect = subAreaFieldSelect.getElementsByTagName("select")[0]


  fileConfig.appendChild(geoFilePick)
  fileConfig.appendChild(document.createElement("div"))

  fileConfig.appendChild(rowFilePick)
  fileConfig.appendChild(idFieldSelect)

  fileConfig.appendChild(weightFilePick)
  fileConfig.appendChild(document.createElement("div"))

  fileConfig.appendChild(subAreaFieldSelect)
}

function createDataControlElement() {
  const dataControls = document.getElementById("data-controls")
  
  const valueFieldSelect = elem.createSelect("Value Field:", [], "Awaiting file...")
  elements.valueFieldSelect =  valueFieldSelect.getElementsByTagName("select")[0]
  elements.valueFieldSelect.addEventListener("change", () => {
    const vField = elements.valueFieldSelect.value
    state.plotData.features.forEach(feature => 
      feature.properties[vField] = parseFloat(feature.properties[vField]))
    plots.dataMap.setVField(vField)
    plots.dataMap.dataUpdated()
  })

  const areaSelect = elem.createSelect("Area:", [], "All", true)
  elements.areaSelect = areaSelect.getElementsByTagName("select")[0]
  elements.areaSelect.addEventListener("change", () => {
    setArea(elements.areaSelect.value)
    plotBaseData()
  })

  dataControls.appendChild(valueFieldSelect)
  dataControls.appendChild(areaSelect)
}

function runMoran() {
  const weightMatrix = geo.calculateWeightMatrix(state.plotData, "Rook")
  geo.calculateMoran(state.plotData.features, elements.valueFieldSelect.value, weightMatrix)
}

function uploadDefaults() {

  // Add all file picker defaults
  // const geoFileSelect = document.querySelector("#geo-file-pick > select")
  // const rowFileSelect = document.querySelector("#row-file-pick > select")

  const geoFileSelect = elements.geoFileSelect
  const rowFileSelect = elements.rowFileSelect

  Promise.all([
    d3.json("data/us_topology_county.geojson"), 
    d3.json("data/us_topology_state.geojson"),
    d3.csv("data/chr_data_2022_small.csv")
  ]).then((data) => {
    const [geoDataCounty, geoDataState, rowData] = data

    elem.addOption(geoFileSelect, "us_topology_county.geojson", true)
    fileState.geoDataMap.set("us_topology_county.geojson", geoDataCounty)

    elem.addOption(geoFileSelect, "us_topology_state.geojson", true)
    fileState.geoDataMap.set("us_topology_state.geojson", geoDataState)

    elem.addOption(rowFileSelect, "chr_data_2022.csv", true)
    fileState.geoDataMap.set("chr_data_2022.csv", rowData)

    state.geoData = geoDataCounty
    state.rowData = rowData

    changeRowData(geoFileSelect.value, false)
    dataChanged()
    runMoran()
    plotBaseData()
  })
}

createFileConfigElement()
createDataControlElement()
uploadDefaults() 



// =====================

function fileParser(parseFile) {
  return async function(file)  {
    const reader = new FileReader()

    return new Promise((resolve, reject) => {
      function read(e) {
        resolve(parseFile(e, file))
      }

      reader.addEventListener("load", read, false)
      if (file) {
        reader.readAsText(file)
      }
    })
  }
}

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
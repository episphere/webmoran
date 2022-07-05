import * as elements from "./elements.js"

const fileState = {
  geoDataMap: new Map(),
  rowDataMap: new Map(),
  weightFileMap: new Map(),
}

const configState = {
  idField: "fipscode",
  splitAreaField: "state",
  focusArea: "VA",
  vField: "adult_smoking",
}

const state = {
  geoData: null,
  rowData: null
}

function changeGeoData(id) {
  console.log("Changing geo data to:", id)
  
  dataChanged()
}

function changeRowData(id) {
  console.log("Changing row data to:", id)

  dataChanged()
}

function dataChanged() {
  console.log(state.geoData, state.rowData)

  // Combine geo data and row data
  // Populate ID field select, sub-area field select, vField select, and area select
  // Plot choropleth
  // Plot (empty) Moran scatter
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
  const geoFilePick = elements.createFilePick("Geography:", geoFileParser, geoChangeListener)
  

  // Row file picker
  const rowFileParser = fileParser((e, file) => {
    let data = d3.csvParse(e.currentTarget.result)
    fileState.rowDataMap.set(file.name, data)
  })
  const rowChangeListener = e => {
    changeRowData(e.target.value)
  }
  const rowFilePick = elements.createFilePick("Row Data:", rowFileParser, rowChangeListener)
  
  
  const weightFilePick = elements.createFilePick("Weights:", file => {
    // TODO: Implement weight parsing
    weightFileMap.set(file.name, "...")
  })


  // Add all file picker defaults
  const geoFileSelect = geoFilePick.getElementsByTagName("select")[0]
  const rowFileSelect = rowFilePick.getElementsByTagName("select")[0]

  Promise.all([
    d3.json("data/us_topology_county.geojson"), 
    d3.json("data/us_topology_state.geojson"),
    d3.csv("data/chr_data_2022.csv")
  ]).then((data) => {
    const [geoDataCounty, geoDataState, rowData] = data
    elements.addOption(geoFileSelect, "us_topology_county.geojson", true)
    fileState.geoDataMap.set("us_topology_county.geojson", geoDataCounty)

    elements.addOption(geoFileSelect, "us_topology_state.geojson", true)
    fileState.geoDataMap.set("us_topology_state.geojson", geoDataState)

    elements.addOption(rowFileSelect, "chr_data_2022.csv", true)
    fileState.geoDataMap.set("chr_data_2022.csv", rowData)

    state.geoData = geoDataCounty
    state.rowData = rowData
    dataChanged()
  })


  const idFieldSelect = elements.createSelect("ID Field:", [], "Awaiting file...")
  const subAreaFieldSelect = elements.createSelect("Sub-Area Field:", [], "None")


  fileConfig.appendChild(geoFilePick)
  fileConfig.appendChild(document.createElement("div"))

  fileConfig.appendChild(rowFilePick)
  fileConfig.appendChild(idFieldSelect)

  fileConfig.appendChild(weightFilePick)
  fileConfig.appendChild(document.createElement("div"))

  fileConfig.appendChild(subAreaFieldSelect)
}

function fileParser(parseFile) {
  return file => {
    const reader = new FileReader()

    function read(e) {
      parseFile(e, file)
    }

    reader.addEventListener("load", read, false)
    if (file) {
      reader.readAsText(file)
    }
  }
}

createFileConfigElement()
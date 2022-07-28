// FINAL RW

import {default as React} from "https://cdn.skypack.dev/react@18.2.0?min"
import {default as ReactDOM} from "https://cdn.skypack.dev/react-dom@18.2.0?min"


class Select extends React.Component {
  constructor(props) {
    super(props)
    this.handleChange = this.handleChange.bind(this)
  }

  handleChange(e) {
    this.props.onChange(e.target.value) 
  }

  render() {
    const pairs = this.props.options.map(d => typeof d == "object" ? d :  ({label: d, value: d}))

    const options = pairs.map(pair => {
      return React.createElement("option", {value: pair.value}, `${pair.label}`)
    })
    
    return React.createElement("select", {
      onChange: this.handleChange, 
      value: this.props.value
    }, options)
  }
}

class FileSelect extends React.Component {
  constructor(props) {
    super(props)
    this.handleChange = this.handleChange.bind(this)
    this.fileUpload = this.fileUpload.bind(this)
  }

  fileUpload(file) {
    
    this.readFile(file).then(e => {
      const data = this.props.parse(e.currentTarget.result)
      this.props.onUpload(file.name, data)
    })
  }

  handleChange(name) {
    this.props.onChange(name, this.fileDataMap.get(name)) 
  }

  render() {
    const options = this.props.fileData.map(d => {
      return {label: d.fileName, value: d.fileName}
    })

    this.fileDataMap = new Map(this.props.fileData.map(d => [d.fileName, d.data]))
    const value = this.props.value ? this.props.value : options[0].label
    console.log("value", value)
    
    const fileSelect = React.createElement(Select, {
      onChange: d => this.handleChange(d), options: options, value: value
    }, [])

    const fileInput = document.createElement("input")
    fileInput.setAttribute("type", "file")
    fileInput.style.display = "none"
    fileInput.addEventListener("change", e => {
      const file = e.target.files[0]
      this.fileUpload(file) 
    })

    const button = React.createElement("button", {
      onClick: () => fileInput.click()
    }, "Upload")

    return React.createElement("div", null, [fileSelect, button])
  }

  async readFile(file) {
    const reader = new FileReader()
    return new Promise((resolve, reject) => {
      function read(e) {
        resolve(e)
      }

      reader.addEventListener("load", read, false)
      if (file) {
        reader.readAsText(file)
      }
    })
  }
}


class WebMoran extends React.Component {
  constructor(props) {
    super(props)
    this.setup()
  }

  setup() {
    const defaultGeoFiles = [
      {fileName: "test1.json", data: ["Hello!"]},
      {fileName: "test2.json", data: ["Hi!"]}
    ]

    const defaultRowFiles = [
      {fileName: "test1.json", data: ["Hello!"]},
      {fileName: "test2.json", data: ["Hi!"]}
    ] 

    this.state = {
      geoFiles: defaultGeoFiles,
      geoFileSelected: defaultGeoFiles[1].fileName,
      rowFiles: defaultRowFiles,
      rowFileSelected: defaultRowFiles[1].fileName,
    }

  }

  onUploadGeo(name, data) {
    this.setState({
      rowFiles: [...this.state.rowFiles, {fileName: name, data: data}],
      rowFileSelected: name,
    })
  }

  onChangeGeo(name, data) {
    this.setState({
      rowFileSelected: name,
    })
  }

  onUploadRow(name, data) {

  }

  onChangeRow(name, data) {

  }

  render() {

    const geoFileSelect = React.createElement(FileSelect, {
      onUpload: (name, data) => this.onUploadGeo(name, data),
      onChange: (name, data) => this.onChangeGeo(name, data),
      parse: d => d,
      fileData: this.state.rowFiles,
      value: this.state.rowFileSelected
    }, [])


    ReactDOM.render(geoFileSelect, document.getElementById("geo-file-pick"))

    return false 
  }
}

ReactDOM.render(React.createElement(WebMoran, null), document.createElement("div"))



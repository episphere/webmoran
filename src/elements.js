export function createFilePick(labelText, parser, changeListener) {
  const mainDiv = document.createElement("div")
  mainDiv.classList.add("ginput-file")

  const label = document.createElement("label")
  label.innerHTML = labelText 

  const select = document.createElement("select")
  const defaultOption = document.createElement("option")
  defaultOption.classList.add("ginput-select-default")
  defaultOption.innerHTML = "Upload a file..."
  defaultOption.setAttribute("disabled", "")
  defaultOption.setAttribute("hidden", "")
  defaultOption.setAttribute("selected", "")
  select.appendChild(defaultOption)

  const fileInput = document.createElement("input")
  fileInput.setAttribute("type", "file")
  fileInput.style.display = "none"
  fileInput.addEventListener("change", e => {
    const file = e.target.files[0]
    const fileOption = document.createElement("option")
    fileOption.innerHTML = file.name
    fileOption.value = file.name
    parser(file)
    select.appendChild(fileOption)
    fileOption.setAttribute("selected", "")
  })

  const uploadButton = document.createElement("button")
  uploadButton.innerHTML = `<span class="material-icons">file_upload</span>`
  uploadButton.addEventListener("click", e => {
    fileInput.click()
   
  })

  mainDiv.append(label)
  mainDiv.append(fileInput)
  mainDiv.append(select)
  mainDiv.append(uploadButton)

  select.addEventListener("change", changeListener)

  return mainDiv
}

export function createSelect(labelText, options=[], placeholderText=null) {
  const mainDiv = document.createElement("div")
  mainDiv.classList.add("ginput-select")

  const label = document.createElement("label")
  label.innerHTML = labelText 

  const select = document.createElement("select")

  if (placeholderText) {
    const defaultOption = document.createElement("option")
    defaultOption.classList.add("ginput-select-default")
    defaultOption.innerHTML = placeholderText
    defaultOption.setAttribute("disabled", "")
    defaultOption.setAttribute("hidden", "")
    defaultOption.setAttribute("selected", "")
    select.appendChild(defaultOption)
  }

  for (const [str, value] of options) {
    const option = document.createElement("option")
    option.innerHTML = str
    select.appendChild(option)
  }

  mainDiv.append(label)
  mainDiv.append(select)
  
  return mainDiv
}

export function addOption(select, field, selected=false) {
  const option = document.createElement("option")
  option.setAttribute("value", field)
  option.innerHTML = field
  if (selected) {
    option.setAttribute("selected", "")
  }
  select.appendChild(option)
}
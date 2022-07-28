import {Plot} from "./Plot.js"
import * as d3 from "https://cdn.skypack.dev/d3@7"

export class MoranPlot extends Plot {
  constructor(element, moranResult, opts) {
    super(element, opts, {
      xField: "z",
      yField: "lag",
      colorField: "localMoran",
      xDomainFixed: null,
      yDomainFixed: null,
      jitter: 0,
      equalAxis: true,
      centerZero: true,
      centerColorZero: true,
      fixedColorScale: null,
      fillColorFunction: null,
      colorScheme: d3.interpolateCividis,
      hoverRadius: 20,
      state: null,
      numberFormat: d => d,
      radialMap: null,
      radialOuterRadius: 50 ,
      radialInnerRadius: 10,
      regressionColor: "slategrey",
    })

    this.moranResult = moranResult

    this.setup()
    this.createBase()
    this.dataUpdate(moranResult, this.radialMap)

    element.append(this.nodes.base.node())
  }

  setup() {
    if (!this.state) {
      this.state = new DynamicState()
    }

    if (!this.fillColorFunction) {
      this.fillColorFunction = this.fill
    }

    const numberFormatBase = this.numberFormat
    const numberFormat = d => {
      if (typeof d == "number") {
        return numberFormatBase(d)
      } else {
        return d
      }
    }
    this.numberFormat = numberFormat
   
    this.state.defineProperty("focused", null)
    this.state.defineProperty("select", new Set())
    this.state.addListener((p, v, o) => {
      this.stateChanged(p, v, o)
    })
  }

  createBase() {
    this.nodes.base
      .attr("width", this.width)
      .attr("height", this.height)
      .on("mousemove", e => this.mouseMoved(e))

    this.nodes.axisX = this.nodes.base.append("g")   
      .attr("id", "axisX")   
    this.nodes.axisY = this.nodes.base.append("g")
      .attr("id", "axisX")  

    this.nodes.points = this.nodes.base.append("g")
    this.nodes.grid = this.nodes.base.append("g")

    this.tooltip = d3.select(this.element).append("div")
      .style("opacity", 0)
      .attr("class", "tooltip")
      .style("background-color", "rgba(255, 255, 255, .7)")
      .style("border", "solid")
      .style("border-width", "1px")
      .style("border-radius", "2px")
      .style("padding", "5px")
      .style("position", "absolute")
      .style("font-size", ".6em")
      .style("pointer-events", "none")

    this.nodes.regressionLine = this.nodes.base.append("g")
    this.nodes.moranValue = this.nodes.base.append("g")

    this.moranTip = d3.select(this.element).append("div")
      .style("position", "absolute")
      .style("font-size", ".6em")
      .style("pointer-events", "none")


    this.nodes.radial = this.nodes.base.append("g")
      .attr("id", `${this.id}-radial`)
  }

  dataUpdate(moranResult, radialMap = null) {
    this.moranResult = moranResult
    this.radialMap = radialMap

    if (this.xDomainFixed) {
      this.xDomain = d3.extent(this.xDomainFixed)
    } else {
      this.xDomain = d3.extent(this.moranResult.localMorans, d => d[this.xField])
    }
    this.scaleX = d3.scaleLinear()
      .domain(this.xDomain)
      .range([this.margin.left, this.width - this.margin.right])

    if (this.yDomainFixed) {
      this.yDomain = d3.extent(this.yDomainFixed)
    } else {
      this.yDomain = d3.extent(this.moranResult.localMorans, d => d[this.yField])
    }
    this.scaleY = d3.scaleLinear()
      .domain(this.yDomain)
      .range([this.height - this.margin.bottom, this.margin.top])

    if (this.equalAxis) {
      if (Math.abs(this.scaleX.domain()[1] - this.scaleX.domain()[0]) <
          Math.abs(this.scaleY.domain()[1] - this.scaleY.domain()[0])) {
        this.scaleX.domain(this.scaleY.domain())
      } else if (Math.abs(this.scaleY.domain()[1] - this.scaleY.domain()[0]) <
                  Math.abs(this.scaleX.domain()[1] - this.scaleX.domain()[0])) {
        this.scaleY.domain(this.scaleX.domain())
      }
    } 

    if (this.centerZero) {
      const xMaxMag = Math.max(...this.scaleX.domain().map(d => Math.abs(d)))
      this.scaleX.domain([-xMaxMag, xMaxMag])
      const yMaxMag = Math.max(...this.scaleY.domain().map(d => Math.abs(d)))
      this.scaleY.domain([-yMaxMag, yMaxMag])
    }

    //this.radialDomain = this.xDomain
    this.scaleRadial = d3.scaleLinear()
      .domain(this.xDomain)
      .range([this.radialInnerRadius, this.radialOuterRadius])

    this.createAxisLeft(this.nodes.axisY, this.scaleY, this.yField)
    this.createAxisBottom(this.nodes.axisX, this.scaleX, this.xField)
    this.createGrid(this.nodes.grid, this.scaleX, this.scaleY,
      new Set([0]), new Set([0]))


    if (!this.fixedColorScale) {
      let valueExtent = d3.extent(this.moranResult.localMorans, 
        d => d[this.colorField])

      if (this.centerColorZero) {
        const colorMaxMag = Math.max(...valueExtent.map(d => Math.abs(d)))
        valueExtent = [-colorMaxMag, colorMaxMag]
      }

      this.colorScale = d3.scaleSequential(this.colorScheme)
        .domain(valueExtent)   

    } else {
      this.colorScale = this.fixedColorScale
    }

    this.nodes.points.selectAll("circle")
      .data(this.moranResult.localMorans)
      .join("circle")
        .attr("id", d => `${this.id}-dot-${d.id}`)
        .attr("r", 2)
        .attr("cx", d => this.scaleX(d[this.xField]) - this.jitter + Math.random()*this.jitter*2)
        .attr("cy", d => this.scaleY(d[this.yField]) - this.jitter + Math.random()*this.jitter*2)
        .attr("fill", d => this.fillColorFunction(d))

    this.delaunay = d3.Delaunay.from(this.moranResult.localMorans, 
      d => this.scaleX(d[this.xField]), d => this.scaleY(d[this.yField]))

    const points = [ 
      [this.scaleX.domain()[0], this.moranResult.globalMoran * this.scaleX.domain()[0]],
      [this.scaleX.domain()[1], this.moranResult.globalMoran * this.scaleX.domain()[1]]
    ]
    if (this.regressionColor) {
      const line = d3.line()
        .x(d => this.scaleX(d[0]))
        .y(d => this.scaleY(d[1]))

      this.nodes.regressionLine.selectAll("path")
        .data([points])
        .join("path")
          .attr("d", line)
          .attr("stroke", this.regressionColor)
          .attr("stroke-width", 1)
          .attr("fill", "none")
    }

    this.moranTip.style("left", `${this.scaleX(points[1][0]) + 5}px`)
    this.moranTip.style("top", `${this.scaleY(points[1][1]) - 10}px`)
    this.moranTip.style("text-align", `right`)
    
    const content = [`<b>I</b> = ${this.moranResult.globalMoran.toFixed(3)}`]
    content.push(`<b>p'</b> = ${this.moranResult.p != null ? 
      this.moranResult.p.toFixed(3) : "..."}`)
    this.moranTip.html(content.join("</br>"))    

    // this.nodes.moranValue.selectAll("text")
    //   .data([this.moranResult.globalMoran])
    //   .join("text")
    //     .attr("x", this.scaleX(points[1][0]) + 5)
    //     .attr("y", this.scaleY(points[1][1]))
    //     .attr("font-size", "10px")
    //     .html(`Moran's I: </br> ${this.moranResult.globalMoran}`)
  }

  stateChanged(p, v, o) {

    if (p == "focused" && v != o) {
      d3.select(`#${this.id}-dot-${v}`)
        .attr("r", 8)
      d3.select(`#${this.id}-dot-${o}`)
        .attr("r", 2)

      if (v != null) {
        const localMoran = this.moranResult.localMorans.find(d => d.id == v)
        if (!localMoran) {
          return
        }

        let tooltipText = `(${this.numberFormat(localMoran[this.xField])}, 
          ${this.numberFormat(localMoran[this.yField])})`
        if (this.colorField) {
          tooltipText += ` | ${this.numberFormat(localMoran[this.colorField])}`
        }

        const pos = [
          this.scaleX(localMoran[this.xField]), 
          this.scaleY(localMoran[this.yField])
        ]

        if (!this.radialMap) {
          this.tooltip.style("opacity", 1)
          this.tooltip.style("left", `${pos[0] + 10}px`)
          this.tooltip.style("top", `${pos[1] + 10}px`)
          this.tooltip.html(tooltipText)   
        }
 

        if (this.radialMap) {
          this.nodes.radial.selectAll("circle").remove()

          const localRadial = this.radialMap.get(localMoran.id)
    
          this.nodes.radial.selectAll("path")
            .data(localRadial.segments)
            .join("path")
            .attr("fill", d => this.fillColorFunction(d.data))
            .attr("d", d => {
              const arc = d3.arc()
                .innerRadius(this.radialInnerRadius)
                .outerRadius(this.scaleRadial(d.data.z))
                .startAngle(d.startAngle)
                .endAngle(d.endAngle)
              return arc(d)
            })

          this.nodes.radial.selectAll("circle")
            //.data([0, this.xDomain[1]])
            .data([0])
            .join("circle")
              .attr("cx", 0)
              .attr("cy", 0)
              .attr("r", d => this.scaleRadial(d))
              .attr("stroke", "rgba(119,136,153,.5)")
              .attr("fill", "none")

          localRadial.segments = d3.sort(localRadial.segments, d => d.startAngle) // TODO: Remove

          this.nodes.radial.style("visibility", "visible")
          this.nodes.radial.attr("transform", 
            `translate(${pos[0]}, ${pos[1]})rotate(${360*(localRadial.rotateAngle/(Math.PI*2))})`)
        }
       

      } else {
        this.tooltip.style("opacity", 0)
        this.nodes.radial.style("visibility", "hidden")
      }

    }
  }

  setColorScheme(scheme) {
    this.colorScheme = scheme 
    this.colorScale.interpolator(this.colorScheme)
    this.nodes.points.selectAll("circle")
      .attr("fill", d => this.fillColorFunction(d))
    this.nodes.radial.selectAll("path")
      .attr("fill", d => {
        return this.fillColorFunction(d.data)
      })
  }

  setFillColorFunction(fillColorFunction) {
    this.fillColorFunction = fillColorFunction ? fillColorFunction : this.fill
    console.log(this.colorScale.domain(), this.colorScale.range())

    this.nodes.points.selectAll("circle")
      .attr("fill", d => this.fillColorFunction(d))
    this.nodes.radial.selectAll("path")
      .attr("fill", d => {
        return this.fillColorFunction(d.data)
      })
  }

  fill(d) {
    return this.colorScale(d[this.colorField])
  }

  setColorField(colorField) {
    this.colorField = colorField
  }

  mouseMoved(e) {
    if (!this.delaunay) {
      return
    }

    const hovered = this.moranResult.localMorans[this.delaunay.find(e.offsetX, e.offsetY)]
    const p = [this.scaleX(hovered[this.xField]), this.scaleY(hovered[this.yField])]
    const dist = Math.hypot(p[0] - e.offsetX, p[1] - e.offsetY)

    if (dist <= this.hoverRadius) {
      this.state.focused = hovered.id
    } else {
      this.state.focused = null
    }
  }
}
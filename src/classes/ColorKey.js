import * as d3 from "https://cdn.skypack.dev/d3@7"

export class ColorKey {
  constructor(element, scale, type, opts={}) {
    this.element = element 
    this.scale = scale
    this.type = type

    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild)
    }

    Object.assign(this, {
      width: 60, height: 200,
      margin: {left: 10, right: 30, top: 10, bottom: 10},
      N: 8,
      title: null,
      ...opts
    })



    this.nodes = {}
    this.createBase()
  }

  createBase() {
    this.nodes.base = d3.create("svg")
      .attr("width", this.width)
      .attr("height", this.height)

    this.element.appendChild(this.nodes.base.node())

    const keyMargin = this.title ? this.margin.top + 8 : this.margin.top

    if (this.title) {
      this.nodes.base.append("text")
        .attr("x", this.margin.left)
        .attr("y", 10)
        .text(this.title)
        .style("font-size", "8px")
        // .style("font-weight", "bold")
        .style("font-family", "sans-serif")
    }

    if (this.type == "continuous") {
    
      
      this.nodes.bar = this.nodes.base.append("rect")
        .attr("x", this.margin.left)
        .attr("y", keyMargin)
        .attr("width", this.width - this.margin.left - this.margin.right)
        .attr("height", this.height - keyMargin - this.margin.bottom)
        .attr("fill", "url(#color-scale-gradient)")
  
      this.nodes.gradient = this.nodes.base.append("linearGradient")
        .attr("id", "color-scale-gradient")
        .attr("y1", "0%")
        .attr("y2", "100%")
        .attr("x1", 0)
        .attr("x2", 0)

      const gradientStops = []
      const domainWidth = this.scale.domain()[1] - this.scale.domain()[0]
      const step = domainWidth/this.N
      for (let i = this.N; i >= 0; i--) {
        gradientStops.push({p: 1- i*step / domainWidth, 
          color: this.scale(this.scale.domain()[0]+i*step)})
      }

      this.nodes.gradient.selectAll("stop")
        .data(gradientStops)
        .join("stop")
        .attr("offset", d => `${d.p*100}%`)
        .attr("stop-color", d => d.color)

      const axisScale = d3.scaleLinear()
        .domain(this.scale.domain())
        .range([ this.height-this.margin.bottom, keyMargin])
        //.nice()

      const axis = d3.axisRight(axisScale)

      this.nodes.base.append("g")
        .attr("transform", `translate(${this.width-this.margin.right},0)`)
        .call(axis)
    } else {
      const scaleBand = d3.scaleBand()
        .domain(this.scale.domain())
        .range([keyMargin, this.height-this.margin.bottom])

      // TODO: Fix
      const r = 5//scaleBand.step() / 2
      this.nodes.base.selectAll("circle")
        .data(this.scale.domain())
        .join("circle")
          .attr("cx", this.margin.left + r/2)
          .attr("cy", d => scaleBand(d) + scaleBand.bandwidth()/2)
          .attr("r", 5)
          .attr("fill", d => this.scale(d))

      this.nodes.base.append("g")
        .selectAll("text")
        .data(this.scale.domain())
        .join("text")
          .attr("x", this.margin.left + r + 7)
          .attr("y", d => scaleBand(d) + scaleBand.bandwidth()/2 + 4)
          .text(d => d)
          .style("font-size", "8px")
          .style("font-family", "sans-serif")
    }
  }
}
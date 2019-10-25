function createElement(qualifiedName, attributes, ...children) {
  const elem = document.createElement(qualifiedName);
  for (const [name, value] of Object.entries(attributes)) {
    elem.setAttribute(name, value);
  }
  for (const child of children) {
    elem.appendChild(child);
  }
  return elem;
}

const xmlns = "http://www.w3.org/2000/svg";
const border = 10;

function createSVGElement(qualifiedName, attributes, ...children) {
  const elem = document.createElementNS(xmlns, qualifiedName);
  for (const [name, value] of Object.entries(attributes)) {
    elem.setAttribute(name, value);
  }
  for (const child of children) {
    elem.appendChild(child);
  }
  return elem;
}

class RektEditor extends HTMLElement {
  constructor() {
    super()

    // Create the shadow root.
    const shadow = this.attachShadow({mode: 'open'});

    this._elems = {};

    // Create span.
    const span = createElement('span', {'class': 'hellospan'});
    this._elems.span = span;

    // Create some CSS to apply to the shadow dom.
    const style = createElement('style', {});

    style.textContent = `.hellospan { color: green; }

    html, body {
      background:#eee; margin:0;
    }
    svg {
        /* position:absolute; top:5%; left:5%; width:90%; height:90%; */
        background:#fff; border:1px solid #ccc;
        stroke-width:0.5px;
    }

    /* rect { stroke: #f00; } */

    svg rect.dragg { stroke:#333; fill:#6c6; opacity:0.3; }

    svg .dragg { cursor:move }
    svg .resizer { opacity:0.05; fill:#ff0; stroke:#630; }
    svg .rotator { opacity:0.05; fill:#0f0; stroke:#630; }

    svg g:hover > circle { opacity:0.3; }
    :host {
      display: block;
    }
    :host([hidden]) { display: none }
    `;

    const backgroundImage = createSVGElement('image', {
      // href: 'understanding_the_apple_ii_0007.png',
      // x: 0,
      // y: 0,
      // width: 850,
      // height: 1100,
    });
    this._elems.backgroundImage = backgroundImage;

    const pattern = createSVGElement('pattern',
      {
        id: 'scan',
        patternUnits: 'userSpaceOnUse',
        // width: 850,
        // height: 1100,
        // patternTransform: 'rotate(0.8, 69, 75)',
      },
      backgroundImage);
    this._elems.backgroundPattern = pattern;

    const defs = createSVGElement('defs', {}, pattern);

    const rect = createSVGElement('rect', {
      // x: 69,
      // y: 75,
      // width: 363,
      // height: 981,
      fill: 'url(#scan)',
    });
    this._elems.backgroundRect = rect;

    const imageG = createSVGElement('g',
      {
        // transform: 'rotate(-0.8, 69, 75)',
      },
      rect);
    this._elems.backgroundGroup = imageG;

    const svg = createSVGElement('svg',
      {
        // viewBox: '50 55 400 1020',
      },
      defs, imageG);
    this._elems.svg = svg;

    /*
    const circle = createSVGElement('circle', {
      r: 10,
      cx: 363+79, // 442
      cy: 981+75, // 1056
    });
    svg.appendChild(circle);
    */

    // attach the created elements to the shadow dom
    shadow.appendChild(style);
    shadow.appendChild(span);
    shadow.appendChild(svg);
  }

  connectedCallback() {
    this._upgradeProperty('bgimage');
    this._upgradeProperty('bgimagewidth');
    this._upgradeProperty('bgimageheight');
    this._upgradeProperty('bgwidth');
    this._upgradeProperty('bgheight');
    this._upgradeProperty('bgx');
    this._upgradeProperty('bgy');
    this._upgradeProperty('bgrotate');
  }

  _upgradeProperty(prop) {
    if (this.hasOwnProperty(prop)) {
      let value = this[prop];
      delete this[prop];
      this[prop] = value;
    }
  }

  // Given an x,y point, a width and a height of a rectangle, rotate it, and return the min and max (x,y) coordinates.
  // The sin/cos part is slightly weird because y values are positive down the page.
  _minMax(cx, cy, width, height, rotation) {
    const rads = (+rotation) / 180.0 * Math.PI;
    const s = Math.sin(rads);
    const c = Math.cos(rads);
    const initial = [[0, 0], [+width, 0], [0, +height], [+width, +height]];
    const points = initial
      .map(([x, y]) => [(x*c) + (y*s), (y*c) - (x*s)])
      .map(([x, y]) => [+cx + x, +cy + y]);
    const xs = points.map(([x, y]) => x);
    const ys = points.map(([x, y]) => y);
    return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
  }

  // disconnectedCallback() {
  // }

  static get observedAttributes() {
    return ['bgimage', 'bgimagewidth', 'bgimageheight', 'bgwidth', 'bgheight', 'bgx', 'bgy', 'bgrotate'];
  }

  set bgimage(value) {
    this.setAttribute('bgimage', value);
  }

  get bgimage() {
    return this.getAttribute('bgimage');
  }

  set bgimagewidth(value) {
    this.setAttribute('bgimagewidth', value);
  }

  get bgimagewidth() {
    return this.getAttribute('bgimagewidth');
  }

  set bgimageheight(value) {
    this.setAttribute('bgimageheight', value);
  }

  get bgimageheight() {
    return this.getAttribute('bgimageheight');
  }

  set bgwidth(value) {
    this.setAttribute('bgwidth', value);
  }

  get bgwidth() {
    return this.getAttribute('bgwidth');
  }

  set bgheight(value) {
    this.setAttribute('bgheight', value);
  }

  get bgheight() {
    return this.getAttribute('bgheight');
  }

  set bgx(value) {
    this.setAttribute('bgx', value);
  }

  get bgx() {
    return this.getAttribute('bgx');
  }

  set bgy(value) {
    this.setAttribute('bgy', value);
  }

  get bgy() {
    return this.getAttribute('bgy');
  }

  set bgrotate(value) {
    this.setAttribute('bgrotate', value);
  }

  get bgrotate() {
    return this.getAttribute('bgrotate');
  }

  _setRotate() {
    const rot = this.getAttribute('bgrotate') || 0;
    const x = this.getAttribute('bgx');
    const y = this.getAttribute('bgy');
    this._elems.backgroundPattern.setAttribute('patternTransform', `rotate(${rot},${x},${y})`);
    this._elems.backgroundGroup.setAttribute('transform', `rotate(${-rot},${x},${y})`);
  }

  _setViewBox() {
    const x = this.getAttribute('bgx');
    const y = this.getAttribute('bgy');
    const width = this.getAttribute('bgwidth');
    const height = this.getAttribute('bgheight');
    const rotate = this.getAttribute('bgrotate');
    const [[minx, miny], [maxx, maxy]] = this._minMax(x, y, width, height, rotate);
    this._elems.svg.setAttribute('viewBox', `${minx-border} ${miny-border} ${maxx-minx+border*2} ${maxy-miny+border*2}`);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // console.log(`attribute changed: ${name}`);
    switch (name) {
      case 'bgimage':
        this._elems.backgroundImage.setAttribute('href', newValue);
        break;
      case 'bgimagewidth':
        this._elems.backgroundImage.setAttribute('width', newValue);
        this._elems.backgroundPattern.setAttribute('width', newValue);
        break;
      case 'bgimageheight':
        this._elems.backgroundImage.setAttribute('height', newValue);
        this._elems.backgroundPattern.setAttribute('height', newValue);
        break;
      case 'bgwidth':
        this._elems.backgroundRect.setAttribute('width', newValue);
        this._setViewBox();
        break;
      case 'bgheight':
        this._elems.backgroundRect.setAttribute('height', newValue);
        this._setViewBox();
        break;
      case 'bgx':
        this._elems.backgroundRect.setAttribute('x', newValue);
        this._setRotate();
        this._setViewBox();
        break;
      case 'bgy':
        this._elems.backgroundRect.setAttribute('y', newValue);
        this._setRotate();
        this._setViewBox();
        break;
      case 'bgrotate':
        this._setRotate();
        this._setViewBox();
        break;
    }
  }
}

customElements.define('rekt-editor', RektEditor);

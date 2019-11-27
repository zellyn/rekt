/*
  Credits:

  Thanks to Phrogz for https://stackoverflow.com/a/5223921/23582
  (and http://phrogz.net/svg/drag_under_transformation.xhtml),
  explaining how to drag under transformation.

  Thanks to Peter Collingridge for
  http://www.petercollingridge.co.uk/tutorials/svg/interactive/dragging/,
  explaining how to drag with svg-wide event listeners, and handling
  mobile touches.
 */

// http://jointjs.com/blog/get-transform-to-element-polyfill.html
SVGElement.prototype.getTransformToElement = SVGElement.prototype.getTransformToElement || function (toElement) {
  return toElement.getScreenCTM().inverse().multiply(this.getScreenCTM());
};

const xmlns = "http://www.w3.org/2000/svg";
const border = 10;

function makeUid(bytes) {
  return [...Array(2 * bytes)].map(_ => Math.floor(Math.random() * 16).toString(16)).join('');
}

const dragTypes = {
  'MOVE': 'MOVE',
  'RESIZE': 'RESIZE',
  'ROTATE': 'ROTATE',
  'CREATE': 'CREATE',
}

// DragInfo holds information about the current drag.
class DragInfo {
  constructor(group, typ, mouseStart) {
    this.typ = typ;
    this.mouseStart = mouseStart;
    if (typ === dragTypes.CREATE) {
      return;
    }

    this.group = group;
    this.svg = group.ownerSVGElement;
    this.parent = group.parentNode;
    this.rect = group.getElementsByTagName('rect')[0];
    this.id = this.group.getAttribute('id');
    this.resizer = group.getElementsByClassName('resizer')[0];
    this.rotator = group.getElementsByClassName('rotator')[0];
    switch (typ) {
      case dragTypes.MOVE:
        this.elementStart = this.coords();
        break;
      case dragTypes.RESIZE:
        this.elementStart = { x: this.resizer.cx.animVal.value, y: this.resizer.cy.animVal.value };
        break;
      case dragTypes.ROTATE:
        this.elementStart = this.rotParentCoords();
        break;
      case dragTypes.CREATE:
        break; // Just use mouseStart
      default:
        throw `Unknown dragType: ${typ}`;
    }
  }

  rotParentCoords() {
    const pt = this.svg.createSVGPoint();
    pt.x = this.rotator.cx.animVal.value;
    pt.y = this.rotator.cy.animVal.value;
    return pt.matrixTransform(this.rect.getTransformToElement(this.parent));
  }

  coords() {
    const m = this.group.transform.baseVal[0].matrix;
    return { x: m.e, y: m.f };
  }
}

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

// https://stackoverflow.com/a/16436975/23582
function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  for (const i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function rectsEqual(a, b) {
  if (a === b) return true;
  if (a.id !== b.id) return false;
  if (a.x !== b.x) return false;
  if (a.y !== b.y) return false;
  if (a.width !== b.width) return false;
  if (a.height !== b.height) return false;
  if (a.rotate !== b.rotate) return false;
}

class RektEditor extends HTMLElement {
  constructor() {
    super()

    // Create the shadow root.
    const shadow = this.attachShadow({ mode: 'open' });

    this._elems = {};
    this._handlers = {
      startDrag: e => this.startDrag(e),
      drag: e => this.drag(e),
      endDrag: e => this.endDrag(e),
    };

    // Create span.
    const span = createElement('span', { 'class': 'hellospan' });
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

    /* rect#bgimg { stroke: #f00; } */

    svg rect.dragg { stroke:#333; fill:#6c6; opacity:0.3; }

    svg .dragg { cursor:move }
    svg .resizer { opacity:0.05; fill:#ff0; stroke:#630; }
    svg .rotator { opacity:0.05; fill:#0f0; stroke:#630; }

    svg g:hover > circle { opacity:0.3; }
    :host {
      display: inline-block;
    }
    svg g.active rect.dragg {
      opacity: 1;
      fill-opacity: 0.3;
      stroke: #060;
      stroke-width: 0.1em;
      stroke-opacity: 0.5;
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
      id: 'bgimg',
      fill: 'url(#scan)',
    });
    this._elems.backgroundRect = rect;

    const imageG = createSVGElement('g',
      {
        // transform: 'rotate(-0.8, 69, 75)',
      },
      rect);
    this._elems.backgroundGroup = imageG;

    const rects = createSVGElement('g', {
      id: 'rects',
    });
    this._elems.rects = rects;

    const svg = createSVGElement('svg',
      {
        // viewBox: '50 55 400 1020',
      },
      defs, imageG, rects);
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
    this.clearState();
  }

  clearState() {
    // A map from rect id to rect object.
    this._rects = {};
    // A list of rect ids.
    this._rectOrder = [];
    // 0-based index of active rect.
    this._activeRect = null;

    // The currently active drag event.
    this._dragInfo = null;

    // Default rotation.
    this._defaultRotate = 0;
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
    this._upgradeProperty('rectangles');

    // Add event handlers.
    const svg = this._elems.svg;

    svg.addEventListener('mousedown', this._handlers.startDrag);
    svg.addEventListener('mousemove', this._handlers.drag);
    svg.addEventListener('mouseup', this._handlers.endDrag);
    svg.addEventListener('mouseleave', this._handlers.endDrag);
    // For mobile.
    // TODO(zellyn): figure out why these cause this and how to do it properly:
    //   [Violation] Added non-passive event listener to a
    //   scroll-blocking 'touchstart' event. Consider marking event
    //   handler as 'passive' to make the page more responsive. See
    //   https://www.chromestatus.com/feature/5745543795965952
    // svg.addEventListener('touchstart', this.startDrag);
    // svg.addEventListener('touchmove', this.drag);
    // svg.addEventListener('touchend', this.endDrag);
    // svg.addEventListener('touchleave', this.endDrag);
    // svg.addEventListener('touchcancel', this.endDrag);
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
      .map(([x, y]) => [(x * c) + (y * s), (y * c) - (x * s)])
      .map(([x, y]) => [+cx + x, +cy + y]);
    const xs = points.map(([x, y]) => x);
    const ys = points.map(([x, y]) => y);
    return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
  }

  disconnectedCallback() {
    // Remove event handlers.
    const svg = this._elems.svg;
    svg.removeEventListener('mousedown', this._handlers.startDrag);
    svgremoveEventListener('mousemove', this._handlers.drag);
    svgremoveEventListener('mouseup', e => this._handlers.endDrag);
    svgremoveEventListener('mouseleave', e => this._handlers.endDrag);
    this.clearState();
  }

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
    this._defaultRotate = +rot;
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
    this._elems.svg.setAttribute('viewBox', `${minx - border} ${miny - border} ${maxx - minx + border * 2} ${maxy - miny + border * 2}`);
  }

  attributeChangedCallback(name, oldValue, newValue) {
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

  get rectangles() {
    return this._rectOrder.map(id => this._rects[id]);
  }

  set rectangles(newValue) {
    const err = this._invalidRects(newValue);
    if (err) {
      throw `Invalid rects value (${err}): ${JSON.stringify(newValue)}`;
    }

    const newIds = new Set(newValue.map(rect => rect.id));
    for (const id of [...this._rectOrder]) {
      if (!newIds.has(id)) {
        this._deleteRect(id);
      }
    }

    let activeId = "none";

    newValue.forEach(rect => {
      if (rect.active) activeId = rect.id;
      const oldRect = this._rects[rect.id];
      if (!oldRect) {
        this._addRect(rect);
      } else if (!rectsEqual(rect, oldRect)) {
        this._updateRect(rect);
      }
    });
    this._setActive(activeId);
  }

  _invalidRects(rects) {
    if (!Array.isArray(rects)) return 'must be array';
    const want = ['x', 'y', 'width', 'height', 'id', 'rotate'];
    for (const i in rects) {
      const rect = rects[i];
      const keys = new Set(Object.keys(rect));
      for (const key of want) {
        if (!keys.has(key)) return `#${i} has no ${key} property`;
      }
    }

    // Check for only one active
    return '';
  }

  _deleteRect(id) {
    if (!this._rects[id]) {
      console.warn('cannot delete unknown rect with id "%s"', id);
      return;
    }
    const orderIndex = this._rectOrder.indexOf(id);
    if (orderIndex >= 0) {
      this._rectOrder.splice(orderIndex, 1);
      if (this._activeRect >= orderIndex && this._activeRect > 0) {
        this._activeRect--;
      }
    }
    delete this._rects[id];
    const node = this.shadowRoot.getElementById(id);
    if (node) {
      this._elems.rects.removeChild(node);
    } else {
      console.warn('rect with id "%s" not found in DOM', id);
    }
    this._updateActiveRect();
  }

  _setActive(id) {
    this._activeRect = this._rectOrder.indexOf(id);
    this._updateActiveRect();
  }

  _updateActiveRect() {
    if (this._activeRect < 0 || this._activeRect > this._rectOrder.length) {
      this._activeRect = 0;
    }
    this._rectOrder.forEach((id, index) => {
      if (index === this._activeRect) {
        this._rects[id].active = true;
        this._defaultRotate = this._rects[id].rotate;
        const group = this.shadowRoot.getElementById(id);
        group.classList.add('active');
        if (group.nextElementSibling) {
          this._elems.rects.appendChild(group);
        }
      } else {
        this._rects[id].active = false;
        this.shadowRoot.getElementById(id).classList.remove('active');
      }
    })
  }

  _updateRect(rect) {
    const g = this.shadowRoot.getElementById(rect.id);
    if (!g) {
      console.warn('rect with id "%s" not found in DOM', id);
      return
    }

    g.setAttribute('transform', `translate(${rect.x}, ${rect.y}) rotate(${rect.rotate})`);
    const svgRect = g.getElementsByTagName('rect')[0];
    svgRect.setAttribute('width', rect.width);
    svgRect.setAttribute('height', rect.height);
    const rotator = g.getElementsByClassName('rotator')[0];
    rotator.setAttribute('cy', rect.height);
    const resizer = g.getElementsByClassName('resizer')[0];
    resizer.setAttribute('cx', rect.width);
    resizer.setAttribute('cy', rect.height);
  }

  _addRect(rect) {
    this._rects[rect.id] = rect;
    this._rectOrder.push(rect.id);
    /*
    <g id="rect-5ca1ab1e" transform="translate(142, 271) rotate(20)">
      <rect class="dragg area" x="0" y="0" width="30" height="15" />
      <circle class="dragg rotator" r="3" cx="0" cy="15" />
      <circle class="dragg resizer" r="3" cx="30" cy="15" />
    </g>
    */

    const svgRect = createSVGElement('rect',
      {
        class: 'dragg area',
        x: 0,
        y: 0,
        width: rect.width,
        height: rect.height,
      }
    );

    const circle1 = createSVGElement('circle',
      {
        class: 'dragg rotator',
        r: '0.5em',
        cx: 0,
        cy: rect.height,
      }
    );
    const circle2 = createSVGElement('circle',
      {
        class: 'dragg resizer',
        r: '0.5em',
        cx: rect.width,
        cy: rect.height,
      }
    );

    const g = createSVGElement('g',
      {
        id: rect.id,
        transform: `translate(${rect.x}, ${rect.y}) rotate(${rect.rotate})`,
      },
      svgRect, circle1, circle2
    );
    this._elems.rects.appendChild(g);

    return [g, svgRect, circle1, circle2];
  }

  // Event handling for dragging, clicking, etc.

  startDrag(evt) {
    const target = evt.target;
    const mouseStart = this.cursorPoint(evt);
    if (target.classList.contains('area')) {
      this._dragInfo = new DragInfo(target.parentNode, dragTypes.MOVE, mouseStart);
    } else if (target.classList.contains('resizer')) {
      this._dragInfo = new DragInfo(target.parentNode, dragTypes.RESIZE, mouseStart);
    } else if (target.classList.contains('rotator')) {
      this._dragInfo = new DragInfo(target.parentNode, dragTypes.ROTATE, mouseStart);
    } else {
      this._dragInfo = new DragInfo(null, dragTypes.CREATE, mouseStart);
    }

    if (this._dragInfo.typ !== dragTypes.CREATE) {
      this.bringToFront();
    }
  }

  drag(evt) {
    const di = this._dragInfo;
    if (!di) {
      return;
    }

    evt.preventDefault();

    if (this._dragInfo.typ === dragTypes.CREATE) {
      this.createDraggedRect();
    }

    const current = this.cursorPoint(evt);
    const pt = this._elems.svg.createSVGPoint();
    pt.x = current.x - di.mouseStart.x;
    pt.y = current.y - di.mouseStart.y;

    const frame = (di.typ == dragTypes.RESIZE) ? di.rect : di.parent;

    const offset = this.transformOffset(pt, frame);

    switch (di.typ) {
      case dragTypes.MOVE:
        this.moveRect(offset);
        break
      case dragTypes.RESIZE:
        this.resizeRect(offset);
        break;
      case dragTypes.ROTATE:
        this.rotateRect(offset);
        break;
      default:
        throw `Unknown dragType: ${di.typ}`;
    }
  }

  moveRect(offset) {
    const di = this._dragInfo;
    const m = di.group.transform.baseVal[0].matrix;
    const x = di.elementStart.x + offset.x;
    const y = di.elementStart.y + offset.y;
    m.e = x;
    m.f = y;
    this._rects[di.id].x = x;
    this._rects[di.id].y = y;
  }

  resizeRect(offset) {
    const di = this._dragInfo;
    const w = Math.max(di.elementStart.x + offset.x, 1);
    const h = Math.max(di.elementStart.y + offset.y, 1);
    di.rect.width.baseVal.value = w;
    di.rect.height.baseVal.value = h;
    this.updateHandles();
    this._rects[di.id].width = w;
    this._rects[di.id].height = h;
  }

  rotateRect(offset) {
    const di = this._dragInfo;
    const newX = di.elementStart.x + offset.x;
    const newY = di.elementStart.y + offset.y;
    const coords = di.coords();
    const deltaX = coords.x - newX;
    const deltaY = coords.y - newY;
    var radians = Math.atan2(deltaY, deltaX) + Math.PI * 5 / 2;
    var degrees = (radians * 180 / Math.PI) % 360;
    if (degrees > 180) { degrees = degrees - 360; }
    const r = di.group.transform.baseVal[1];
    r.setRotate(degrees, 0, 0);
    const h = Math.max(Math.sqrt(deltaX * deltaX + deltaY * deltaY), 1);
    di.rect.height.baseVal.value = h;
    this.updateHandles();
    this._rects[di.id].rotate = degrees;
    this._rects[di.id].height = h;
  }

  updateHandles() {
    const di = this._dragInfo;
    const w = di.rect.width.animVal.value;
    const h = di.rect.height.animVal.value;
    di.resizer.cx.baseVal.value = w;
    di.resizer.cy.baseVal.value = h;
    di.rotator.cy.baseVal.value = h;
  }

  createDraggedRect() {
    const di = this._dragInfo;
    di.typ = dragTypes.RESIZE;
    di.elementStart = { x: 0, y: 0 };
    di.parent = this._elems.rects;
    const coords = di.mouseStart.matrixTransform(this._elems.svg.getTransformToElement(di.parent));
    const uid = makeUid(16);
    const id = 'rect-' + uid;

    const [group, rect, rotator, resizer] = this._addRect({
      id: id,
      x: coords.x,
      y: coords.y,
      width: 0,
      height: 0,
      rotate: this._defaultRotate,
    });

    di.group = group;
    di.rect = rect;
    di.resizer = resizer;
    di.rotator = rotator;
    di.id = id;
    this._setActive(id);
  }

  endDrag(evt) {
    if (!this._dragInfo) return;
    const typ = this._dragInfo.typ;
    this._dragInfo = null;
    if (typ !== dragTypes.CREATE) {
      const event = new CustomEvent('rectChange', {
        detail: this.rectangles,
      });
      this.dispatchEvent(event);
    }
  }

  // cursorPoint returns the svg-relative coordinates of a mouse click/touch.
  cursorPoint(evt) {
    if (evt.touches) { evt = evt.touches[0]; }
    const pt = this._elems.svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(this._elems.svg.getScreenCTM().inverse());
  }

  transformOffset(offset, frame) {
    const m = frame.getTransformToElement(this._elems.svg).inverse();
    m.e = m.f = 0; // clear out translation vector
    return offset.matrixTransform(m);
  }

  bringToFront() {
    if (!this._dragInfo) {
      console.log('bringToFront called when no drag is active');
      return;
    }

    this._setActive(this._dragInfo.id);
  }
}

customElements.define('rekt-editor', RektEditor);

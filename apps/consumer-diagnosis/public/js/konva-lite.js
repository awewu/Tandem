(function () {
  if (window.Konva) return;

  function assign(target, source) {
    Object.keys(source || {}).forEach(function (key) {
      target[key] = source[key];
    });
    return target;
  }

  class Node {
    constructor(config) {
      this.config = config || {};
      this.children = [];
      this.handlers = {};
      this._id = this.config.id || '';
      this._name = this.config.name || '';
      this._x = this.config.x || 0;
      this._y = this.config.y || 0;
      this._rotation = this.config.rotation || 0;
      this._visible = this.config.visible !== false;
      this.parent = null;
      this._layer = null;
      this.destroyed = false;
    }

    add(child) {
      if (!child) return this;
      child.parent = this;
      child._layer = this instanceof Layer ? this : this._layer;
      this.children.push(child);
      this.batchDraw();
      return this;
    }

    on(names, handler) {
      String(names || '').split(/\s+/).filter(Boolean).forEach(name => {
        this.handlers[name] = this.handlers[name] || [];
        this.handlers[name].push(handler);
      });
      return this;
    }

    fire(name, event) {
      (this.handlers[name] || []).forEach(handler => handler(event || { target: this, evt: {} }));
    }

    id(value) {
      if (value === undefined) return this._id;
      this._id = value;
      return this;
    }

    name(value) {
      if (value === undefined) return this._name;
      this._name = value;
      return this;
    }

    x(value) {
      if (value === undefined) return this._x;
      this._x = Number(value) || 0;
      this.batchDraw();
      return this;
    }

    y(value) {
      if (value === undefined) return this._y;
      this._y = Number(value) || 0;
      this.batchDraw();
      return this;
    }

    rotation(value) {
      if (value === undefined) return this._rotation;
      this._rotation = Number(value) || 0;
      this.batchDraw();
      return this;
    }

    draggable(value) {
      if (value === undefined) return Boolean(this.config.draggable);
      this.config.draggable = Boolean(value);
      return this;
    }

    visible(value) {
      if (value === undefined) return this._visible;
      this._visible = Boolean(value);
      this.batchDraw();
      return this;
    }

    destroy() {
      this.destroyed = true;
      if (this.parent) {
        this.parent.children = this.parent.children.filter(child => child !== this);
      }
      this.batchDraw();
      return this;
    }

    destroyChildren() {
      this.children = [];
      this.batchDraw();
      return this;
    }

    getLayer() {
      return this instanceof Layer ? this : this._layer;
    }

    batchDraw() {
      const layer = this.getLayer();
      if (layer) layer.batchDraw();
      return this;
    }

    draw(ctx) {
      this.children.forEach(child => {
        if (child && !child.destroyed && child.visible()) child.draw(ctx);
      });
    }
  }

  class Stage extends Node {
    constructor(config) {
      super(config);
      this._width = Math.max(1, config.width || 800);
      this._height = Math.max(1, config.height || 600);
      this._scale = { x: 1, y: 1 };
      this._position = { x: 0, y: 0 };
      this._pointer = { x: this._width / 2, y: this._height / 2 };
      this.container = typeof config.container === 'string' ? document.getElementById(config.container) : config.container;
      if (this.container) {
        this.container.style.position = this.container.style.position || 'relative';
        this.container.addEventListener('mousemove', evt => this._handleDomEvent('mousemove', evt));
        this.container.addEventListener('click', evt => this._handleDomEvent('click', evt));
        this.container.addEventListener('dblclick', evt => this._handleDomEvent('dblclick', evt));
        this.container.addEventListener('mousedown', evt => this._handleDomEvent('mousedown', evt));
        this.container.addEventListener('mouseup', evt => this._handleDomEvent('mouseup', evt));
        this.container.addEventListener('touchmove', evt => this._handleDomEvent('touchmove', evt));
        this.container.addEventListener('touchend', evt => this._handleDomEvent('click', evt));
      }
    }

    add(layer) {
      layer._stage = this;
      layer._layer = layer;
      layer.parent = this;
      layer._setSize(this._width, this._height);
      this.children.push(layer);
      if (this.container && layer.canvas && !layer.canvas.parentNode) {
        this.container.appendChild(layer.canvas);
      }
      layer.batchDraw();
      return this;
    }

    width(value) {
      if (value === undefined) return this._width;
      this._width = Math.max(1, Number(value) || 1);
      this.children.forEach(layer => layer._setSize(this._width, this._height));
      this.batchDraw();
      return this;
    }

    height(value) {
      if (value === undefined) return this._height;
      this._height = Math.max(1, Number(value) || 1);
      this.children.forEach(layer => layer._setSize(this._width, this._height));
      this.batchDraw();
      return this;
    }

    scale(value) {
      if (value === undefined) return this._scale;
      this._scale = assign({ x: 1, y: 1 }, value || {});
      this.batchDraw();
      return this;
    }

    scaleX() {
      return this._scale.x || 1;
    }

    position(value) {
      if (value === undefined) return this._position;
      this._position = assign({ x: 0, y: 0 }, value || {});
      this.batchDraw();
      return this;
    }

    getPointerPosition() {
      return this._pointer;
    }

    getRelativePointerPosition() {
      const scale = this.scaleX() || 1;
      return {
        x: (this._pointer.x - this._position.x) / scale,
        y: (this._pointer.y - this._position.y) / scale
      };
    }

    batchDraw() {
      this.children.forEach(layer => layer.batchDraw());
      return this;
    }

    toDataURL() {
      const composite = document.createElement('canvas');
      composite.width = this._width;
      composite.height = this._height;
      const ctx = composite.getContext('2d');
      this.children.forEach(layer => {
        if (layer.canvas) ctx.drawImage(layer.canvas, 0, 0);
      });
      return composite.toDataURL('image/png');
    }

    _handleDomEvent(name, evt) {
      const rect = this.container.getBoundingClientRect();
      const point = evt.touches && evt.touches[0] ? evt.touches[0] : evt;
      this._pointer = { x: point.clientX - rect.left, y: point.clientY - rect.top };
      this.fire(name, { target: this, evt });
      if (name === 'click') this.fire('tap', { target: this, evt });
      if (name === 'dblclick') this.fire('dbltap', { target: this, evt });
      if (name === 'mousemove') this.fire('touchmove', { target: this, evt });
    }
  }

  class Layer extends Node {
    constructor(config) {
      super(config);
      this.canvas = document.createElement('canvas');
      this.canvas.style.position = 'absolute';
      this.canvas.style.inset = '0';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.ctx = this.canvas.getContext('2d');
    }

    _setSize(width, height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.batchDraw();
    }

    batchDraw() {
      if (!this.ctx) return this;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.draw(this.ctx);
      return this;
    }
  }

  class Transformer extends Node {
    nodes(value) {
      if (value === undefined) return this._nodes || [];
      this._nodes = value || [];
      return this;
    }
  }

  class Rect extends Node {
    draw(ctx) {
      ctx.save();
      ctx.translate(this._x, this._y);
      ctx.rotate(this._rotation * Math.PI / 180);
      if (this.config.fill) {
        ctx.fillStyle = this.config.fill;
        ctx.fillRect(0, 0, this.config.width || 0, this.config.height || 0);
      }
      if (this.config.stroke) {
        ctx.strokeStyle = this.config.stroke;
        ctx.lineWidth = this.config.strokeWidth || 1;
        ctx.strokeRect(0, 0, this.config.width || 0, this.config.height || 0);
      }
      ctx.restore();
    }
  }

  class Line extends Node {
    constructor(config) {
      super(config);
      this._points = config.points || [];
    }

    points(value) {
      if (value === undefined) return this._points;
      this._points = value || [];
      this.batchDraw();
      return this;
    }

    draw(ctx) {
      if (this._points.length < 4) return;
      ctx.save();
      ctx.translate(this._x, this._y);
      ctx.rotate(this._rotation * Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(this._points[0], this._points[1]);
      for (let index = 2; index < this._points.length; index += 2) {
        ctx.lineTo(this._points[index], this._points[index + 1]);
      }
      ctx.strokeStyle = this.config.stroke || '#fff';
      ctx.lineWidth = this.config.strokeWidth || 1;
      ctx.lineCap = this.config.lineCap || 'butt';
      ctx.lineJoin = this.config.lineJoin || 'miter';
      if (this.config.dash) ctx.setLineDash(this.config.dash);
      ctx.globalAlpha = this.config.opacity === undefined ? 1 : this.config.opacity;
      ctx.stroke();
      ctx.restore();
    }
  }

  class Group extends Node {
    draw(ctx) {
      ctx.save();
      ctx.translate(this._x, this._y);
      ctx.rotate(this._rotation * Math.PI / 180);
      this.children.forEach(child => {
        if (child && !child.destroyed && child.visible()) child.draw(ctx);
      });
      ctx.restore();
    }
  }

  class Text extends Node {
    constructor(config) {
      super(config);
      this._text = config.text || '';
      this._fontSize = config.fontSize || 12;
    }

    text(value) {
      if (value === undefined) return this._text;
      this._text = value || '';
      this.batchDraw();
      return this;
    }

    fontSize(value) {
      if (value === undefined) return this._fontSize;
      this._fontSize = Number(value) || 12;
      this.batchDraw();
      return this;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this._x, this._y);
      ctx.rotate(this._rotation * Math.PI / 180);
      ctx.font = `${this._fontSize}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
      ctx.fillStyle = this.config.fill || '#fff';
      ctx.textBaseline = 'top';
      const width = this.config.width || 240;
      const text = this.config.wrap === 'none' && this._text.length > 18 ? this._text.slice(0, 17) + '…' : this._text;
      ctx.fillText(text, 0, 0, width);
      ctx.restore();
    }
  }

  window.Konva = { Stage, Layer, Transformer, Rect, Line, Group, Text };
  window.__rhauttKonvaRuntime = 'local-lite';
})();

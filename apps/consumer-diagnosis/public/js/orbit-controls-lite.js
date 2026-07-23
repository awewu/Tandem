(function () {
  if (!window.THREE || window.THREE.OrbitControls) return;

  window.THREE.OrbitControls = function OrbitControls(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.enableDamping = true;
    this.dampingFactor = 0.05;
    this.target = new window.THREE.Vector3(0, 0, 0);
    this._theta = Math.PI / 4;
    this._phi = Math.PI / 3;
    this._radius = camera.position.distanceTo(this.target) || 20;
    this._dragging = false;
    this._last = { x: 0, y: 0 };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const updateCamera = () => {
      this._phi = clamp(this._phi, 0.12, Math.PI - 0.12);
      const sinPhi = Math.sin(this._phi);
      camera.position.set(
        this.target.x + this._radius * sinPhi * Math.cos(this._theta),
        this.target.y + this._radius * Math.cos(this._phi),
        this.target.z + this._radius * sinPhi * Math.sin(this._theta)
      );
      camera.lookAt(this.target);
    };

    this.update = function () {
      updateCamera();
    };

    this.dispose = function () {
      domElement.removeEventListener('mousedown', onMouseDown);
      domElement.removeEventListener('mousemove', onMouseMove);
      domElement.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('mouseleave', onMouseUp);
      domElement.removeEventListener('wheel', onWheel);
    };

    const onMouseDown = event => {
      this._dragging = true;
      this._last = { x: event.clientX, y: event.clientY };
      event.preventDefault();
    };
    const onMouseMove = event => {
      if (!this._dragging) return;
      const dx = event.clientX - this._last.x;
      const dy = event.clientY - this._last.y;
      this._last = { x: event.clientX, y: event.clientY };
      this._theta -= dx * 0.008;
      this._phi += dy * 0.008;
      updateCamera();
    };
    const onMouseUp = () => {
      this._dragging = false;
    };
    const onWheel = event => {
      this._radius = clamp(this._radius * (event.deltaY > 0 ? 1.08 : 0.92), 4, 80);
      updateCamera();
      event.preventDefault();
    };

    domElement.addEventListener('mousedown', onMouseDown);
    domElement.addEventListener('mousemove', onMouseMove);
    domElement.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('mouseleave', onMouseUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });
    updateCamera();
  };

  window.__rhauttOrbitControlsRuntime = 'local-lite';
})();

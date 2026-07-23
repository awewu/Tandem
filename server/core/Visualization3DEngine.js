/**
 * 3D可视化引擎
 * 
 * 功能：
 * 1. 户型3D渲染
 * 2. 设备3D模型展示
 * 3. 实时预览
 * 4. 高清导出
 * 5. 交互式控制
 */

class Visualization3DEngine {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.models = new Map();
    this.currentModel = null;
    this.isInitialized = false;
    
    // 设备3D模型库
    this.deviceModels = {
      // 热水器
      water_heater: {
        type: 'cylinder',
        dimensions: { height: 1.5, radius: 0.3 },
        color: '#C41230',
        brand: 'rheem'
      },
      // 壁挂炉
      boiler: {
        type: 'box',
        dimensions: { width: 0.8, height: 1.2, depth: 0.4 },
        color: '#C41230',
        brand: 'rheem'
      },
      // 净水系统
      water_purifier: {
        type: 'box',
        dimensions: { width: 0.4, height: 0.6, depth: 0.3 },
        color: '#C41230',
        brand: 'rheem'
      },
      // 中央空调
      central_ac: {
        type: 'box',
        dimensions: { width: 1.2, height: 0.4, depth: 0.8 },
        color: '#E4002B',
        brand: 'ruud'
      },
      // 新风系统
      fresh_air: {
        type: 'box',
        dimensions: { width: 0.6, height: 0.8, depth: 0.5 },
        color: '#E4002B',
        brand: 'ruud'
      },
      // 空气净化器
      air_purifier: {
        type: 'cylinder',
        dimensions: { height: 0.8, radius: 0.2 },
        color: '#E4002B',
        brand: 'ruud'
      }
    };
  }

  /**
   * 初始化3D引擎
   */
  initialize(containerId) {
    if (this.isInitialized) {
      return true;
    }

    try {
      const container = document.getElementById(containerId);
      if (!container) {
        console.error('容器不存在:', containerId);
        return false;
      }

      // 创建场景
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xf0f0f0);

      // 创建相机
      const aspect = container.clientWidth / container.clientHeight;
      this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
      this.camera.position.set(5, 5, 5);
      this.camera.lookAt(0, 0, 0);

      // 创建渲染器
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      this.renderer.shadowMap.enabled = true;
      container.appendChild(this.renderer.domElement);

      // 添加灯光
      this.addLights();

      // 添加网格
      this.addGrid();

      // 添加控制器
      this.addControls();

      this.isInitialized = true;
      console.log('✅ 3D可视化引擎初始化成功');

      return true;
    } catch (error) {
      console.error('❌ 3D引擎初始化失败:', error);
      return false;
    }
  }

  /**
   * 添加灯光
   */
  addLights() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // 定向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // 点光源
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-5, 5, -5);
    this.scene.add(pointLight);
  }

  /**
   * 添加网格
   */
  addGrid() {
    const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc);
    this.scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(5);
    this.scene.add(axesHelper);
  }

  /**
   * 添加控制器
   */
  addControls() {
    // 简单的鼠标控制
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    this.renderer.domElement.addEventListener('mousedown', (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    this.renderer.domElement.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };

      // 旋转场景
      this.scene.rotation.y += deltaMove.x * 0.01;
      this.scene.rotation.x += deltaMove.y * 0.01;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    this.renderer.domElement.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // 滚轮缩放
    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY * 0.01;
      this.camera.position.multiplyScalar(1 + delta);
    });
  }

  /**
   * 创建设备3D模型
   */
  createDeviceModel(deviceType, position = { x: 0, y: 0, z: 0 }) {
    const modelConfig = this.deviceModels[deviceType];
    if (!modelConfig) {
      console.error('未知设备类型:', deviceType);
      return null;
    }

    let geometry;
    const material = new THREE.MeshPhongMaterial({ 
      color: modelConfig.color,
      shininess: 100
    });

    switch (modelConfig.type) {
      case 'box':
        geometry = new THREE.BoxGeometry(
          modelConfig.dimensions.width,
          modelConfig.dimensions.height,
          modelConfig.dimensions.depth
        );
        break;
      
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          modelConfig.dimensions.radius,
          modelConfig.dimensions.radius,
          modelConfig.dimensions.height,
          32
        );
        break;
      
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 添加设备标签
    const label = this.createLabel(deviceType, modelConfig.brand);
    mesh.add(label);

    return mesh;
  }

  /**
   * 创建设备标签
   */
  createLabel(deviceType, brand) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d');

    context.fillStyle = brand === 'rheem' ? '#C41230' : '#E4002B';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = 'white';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(deviceType, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(0, 1.5, 0);
    sprite.scale.set(2, 0.5, 1);

    return sprite;
  }

  /**
   * 渲染户型3D模型
   */
  renderRoomLayout(roomData) {
    if (!this.isInitialized) {
      console.error('3D引擎未初始化');
      return false;
    }

    try {
      // 清除现有模型
      this.clearModels();

      // 创建房间地板
      const floorGeometry = new THREE.PlaneGeometry(roomData.area, roomData.area);
      const floorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xcccccc,
        side: THREE.DoubleSide
      });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.scene.add(floor);

      // 创建房间墙壁
      this.createWalls(roomData);

      // 添加设备
      if (roomData.devices) {
        roomData.devices.forEach((device, index) => {
          const model = this.createDeviceModel(device.type, device.position);
          if (model) {
            this.scene.add(model);
            this.models.set(`device_${index}`, model);
          }
        });
      }

      this.render();
      console.log('✅ 户型3D模型渲染完成');
      return true;
    } catch (error) {
      console.error('❌ 户型3D模型渲染失败:', error);
      return false;
    }
  }

  /**
   * 创建墙壁
   */
  createWalls(roomData) {
    const wallHeight = 3;
    const wallThickness = 0.2;
    const wallMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

    // 前墙
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(roomData.area, wallHeight, wallThickness),
      wallMaterial
    );
    frontWall.position.set(0, wallHeight / 2, -roomData.area / 2);
    this.scene.add(frontWall);

    // 后墙
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(roomData.area, wallHeight, wallThickness),
      wallMaterial
    );
    backWall.position.set(0, wallHeight / 2, roomData.area / 2);
    this.scene.add(backWall);

    // 左墙
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, roomData.area),
      wallMaterial
    );
    leftWall.position.set(-roomData.area / 2, wallHeight / 2, 0);
    this.scene.add(leftWall);

    // 右墙
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, roomData.area),
      wallMaterial
    );
    rightWall.position.set(roomData.area / 2, wallHeight / 2, 0);
    this.scene.add(rightWall);
  }

  /**
   * 渲染设备布局
   */
  renderDeviceLayout(devices) {
    if (!this.isInitialized) {
      console.error('3D引擎未初始化');
      return false;
    }

    try {
      // 清除现有设备模型
      this.clearDeviceModels();

      // 添加新设备
      devices.forEach((device, index) => {
        const model = this.createDeviceModel(device.type, device.position);
        if (model) {
          this.scene.add(model);
          this.models.set(`device_${index}`, model);
        }
      });

      this.render();
      console.log('✅ 设备布局3D渲染完成');
      return true;
    } catch (error) {
      console.error('❌ 设备布局3D渲染失败:', error);
      return false;
    }
  }

  /**
   * 清除所有模型
   */
  clearModels() {
    this.models.forEach((model) => {
      this.scene.remove(model);
    });
    this.models.clear();
  }

  /**
   * 清除设备模型
   */
  clearDeviceModels() {
    this.models.forEach((model, key) => {
      if (key.startsWith('device_')) {
        this.scene.remove(model);
        this.models.delete(key);
      }
    });
  }

  /**
   * 渲染场景
   */
  render() {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 动画循环
   */
  animate() {
    requestAnimationFrame(() => this.animate());
    this.render();
  }

  /**
   * 导出高清图片
   */
  exportHighResImage(width = 1920, height = 1080) {
    if (!this.renderer) {
      console.error('渲染器未初始化');
      return null;
    }

    try {
      // 设置渲染尺寸
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      // 渲染
      this.render();

      // 导出图片
      const dataURL = this.renderer.domElement.toDataURL('image/png');

      // 恢复原始尺寸
      const container = this.renderer.domElement.parentElement;
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();

      return dataURL;
    } catch (error) {
      console.error('❌ 导出高清图片失败:', error);
      return null;
    }
  }

  /**
   * 调整尺寸
   */
  resize() {
    if (!this.renderer || !this.camera) {
      return;
    }

    const container = this.renderer.domElement.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  /**
   * 获取引擎状态
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      modelCount: this.models.size,
      hasScene: !!this.scene,
      hasCamera: !!this.camera,
      hasRenderer: !!this.renderer
    };
  }
}

// 导出单例实例
const visualization3DEngine = new Visualization3DEngine();

module.exports = visualization3DEngine;

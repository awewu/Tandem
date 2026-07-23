# Node.js 单例模式 vs 类构造模式

## 问题场景
模块导出方式混淆导致的构造函数错误

## 两种模式对比

### 模式1: 单例模式 (Singleton)
```javascript
// module.js
class MyClass {
  constructor() { this.data = []; }
  add(item) { this.data.push(item); }
}

// 导出单例实例
module.exports = new MyClass();
```

**使用方式**:
```javascript
// ❌ 错误 - 不能 new
const instance = new require('./module'); // TypeError

// ✅ 正确 - 直接使用
const myModule = require('./module');
myModule.add('item');
```

### 模式2: 类构造模式 (Class)
```javascript
// module.js
class MyClass {
  constructor() { this.data = []; }
  add(item) { this.data.push(item); }
}

// 导出类本身
module.exports = MyClass;
```

**使用方式**:
```javascript
// ❌ 错误 - 不能直接调用方法
const myModule = require('./module');
myModule.add('item'); // TypeError

// ✅ 正确 - 需要 new
const MyClass = require('./module');
const instance = new MyClass();
instance.add('item');
```

## 如何识别

**查看模块导出**:
```javascript
// 查看 module.exports 类型
const exported = require('./module');
console.log(typeof exported); // 'object' = 单例, 'function' = 类
```

## 本次错误

### 错误代码
```javascript
// ❌ 错误 - 尝试 new 单例
const TemplateEngine = require('./TemplateEngine');
const engine = new TemplateEngine(); // TypeError: not a constructor
```

### 正确代码
```javascript
// ✅ 正确 - 直接使用单例
const templateEngine = require('./TemplateEngine');
templateEngine.render(template);
```

## 最佳实践

1. **查看模块源码** - 确认导出方式
2. **阅读文档** - 了解模块设计意图
3. **统一风格** - 项目中保持一致
4. **添加注释** - 说明模块使用方式

## 本次教训

- 使用模块前必须查看其导出方式
- 单例模式：直接 require 使用
- 类模式：需要 new 构造实例
- 导出的是实例对象 vs 类构造函数

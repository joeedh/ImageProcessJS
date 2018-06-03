//global variable to get module IN DEBUG CONSOLE ONLY!!
let _ImageProcess = undefined;

define([
  "./util", "./vectormath", "./simplemesh", "./webgl"
], function(util, vectormath, simplemesh, webgl) {
  "use strict";
  
  let Vector2 = vectormath.Vector2, Vector3 = vectormath.Vector3, Vector4 = vectormath.Vector4;
  
  let exports = _ImageProcess = {};
  
  let _shadercache = {};
  let _shadergl_idgen = 0;
  
  function getShaderProgram(gl, vertex, frag, attributes) {
    if (gl._cache_id === undefined) {
      gl._cache_id = _shadergl_idgen++;
    }
    
    let key = "GL:" + gl._shadergl_idgen + "::" + vertex + "::" + frag + "::" + attributes.toString();
    
    if (key in _shadercache)
      return _shadercache[key];
    
    _shadercache[key] = new webgl.ShaderProgram(gl, vertex, frag, attributes);
    return _shadercache[key];
  }
  
  function clearShaderCache() {
    _shadercache = {};
  }
  
  let FrameBuffer = exports.FrameBuffer = class FrameBuffer {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      
      this.buffer = undefined;
      this.gl = undefined;
    }
    
    update() {
    }
    
    makeBuffer(gl) {
      this.buffer = gl.createFramebuffer();
      this.texture = gl.createTexture();
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.buffer);

      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.FLOAT, new Float32Array(this.width*this.height*4));

      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
      
      //console.log("VALID:", gl.isFramebuffer(this.buffer));
    }
    
    bind(gl) {
      this.gl = gl; //locally cache gl
      
      if (this.buffer === undefined) {
        this.makeBuffer(gl);
      }
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.buffer);
    }
  }
  
  let ProcessTask = exports.ProcessTask = class ProcessTask {
    constructor() {
      this.output = undefined;
    }
    
    run(gl) {
    }
  }
  
  let ImageTask = exports.ImageTask = class ImageTask extends ProcessTask {
    static getShaders() {
      return {
        main : {
          attributes : ["pos"],
          vertex : `
precision mediump float;

uniform vec2 size;
uniform sampler2D image;
attribute vec3 pos;

varying vec2 vPos;
varying vec4 vColor;

void main() {
  vPos = pos.xy*0.5 + 0.5;
  gl_Position = vec4(pos.x, pos.y, 0.0, 1.0);
}
        `,
        
        fragment : `
precision mediump float;
uniform vec2 size;
uniform sampler2D image;
varying vec2 vPos;
varying vec4 vColor;

void main() {
  gl_FragColor = texture2D(image, vPos);
}
        `
        }
      };
    }
    
    constructor(image) {
      super();
      
      if (image === undefined) {
        throw new Error("image cannot be undefined");
      }
      
      if (image.width === undefined) {
        throw new Error("Invalid image (has it not finished loading yet?)");
      }
      
      this.image = image;
      
      this.width = image.width;
      this.height = image.height;
    }
    
    run(gl, process) {
      //load texture
      this.image_texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.image_texture);
      
      if (this.image instanceof ImageData) {
        if (this.image.fdata === undefined) {
          this.image.fdata = new Float32Array(this.image.data);
          
          for (let i=0; i<this.image.fdata.length; i++) {
            this.image.fdata[i] /= 255.0;
          }
        }
        
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.FLOAT, this.image.fdata);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.FLOAT, this.image);
      }
      
      let fbuf = this.output = new FrameBuffer(this.width, this.height);
      
      fbuf.bind(gl);
      
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      if (window.x === undefined) window.x = 0;
      if (window.y === undefined) window.y = 0;
      
      let mesh = new simplemesh.SimpleMesh(ImageTask.shaders.main);
      //let quad = mesh.quad([x, y, 0], [x, y+1, 0], [x+1, y+1, 0], [x+1, y, 0]);
      let quad = mesh.quad([-1, -1, 0], [-1, 1, 0], [1, 1, 0], [1, -1, 0]);
      
      let w = this.width, h = this.height;
      //let quad = mesh.quad([0, 0, 0], [0, h, 0], [w, h, 0], [w, 0, 0]);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.image_texture);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      
      mesh.draw(gl, {
        size  : [this.width, this.height],
        image : new webgl.Texture(0, this.image_texture)
      });
    }
  }

  let BlurTask = exports.BlurTask = class BlurTask extends ProcessTask {
    static getShaders() {
      return {};
    }
    
    static getRuntimeShader() {
      return {
        main : {
          attributes : ["pos"],
          vertex : `
precision mediump float;

uniform vec2 size;
uniform sampler2D image;
attribute vec3 pos;

varying vec2 vPos;
varying vec4 vColor;

void main() {
  vPos = pos.xy*0.5 + 0.5;
  gl_Position = vec4(pos.x, pos.y, 0.0, 1.0);
}
        `,
        
        fragment : `
precision mediump float;
uniform vec2 size;
uniform sampler2D image;
varying vec2 vPos;
varying vec4 vColor;

#define RADIUS _RADIUS_
#define AXIS _AXIS_

void main() {
  vec4 sum;
  float x = -float(RADIUS)*0.5 / size[AXIS];
  float dx = 1.0 / size[AXIS];
  
  for (int i=0; i<RADIUS; i++) {
    vec2 p = vPos;
    p[AXIS] += x;
    
    sum += texture2D(image, p);
    x += dx;
  }
  
  sum /= float(RADIUS);

  gl_FragColor = sum;
}
        `
        }
      };
    }
    
    constructor(task, radius, axis) {
      super();
      
      this.axis = axis;
      this.radius = Math.ceil(radius);
      
      this.width = task.width;
      this.height = task.height;
      
      this.task = task;
    }
    
    run(gl, process) {
      //make shader program
      if (this.width === 0 || this.height === 0 || this.width === undefined || this.height === undefined) {
        throw new Error("width/height were zero");
      }
      
      let sh = BlurTask.getRuntimeShader().main;
      let frag = sh.fragment.replace(/_RADIUS_/g, "" + ~~this.radius);
      frag = frag.replace(/_AXIS_/, ""+this.axis);
      
      let program = new getShaderProgram(gl, sh.vertex, frag, ["pos"]);
      
      let fbuf = this.output = new FrameBuffer(this.width, this.height);
      
      fbuf.bind(gl);
      gl.clearColor(0.0, 0.0, 0.3, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      //return;
      
      if (window.x === undefined) window.x = 0;
      if (window.y === undefined) window.y = 0;
      
      let mesh = new simplemesh.SimpleMesh(program);
      let quad = mesh.quad([-1, -1, 0], [-1, 1, 0], [1, 1, 0], [1, -1, 0]);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.task.output.texture);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      
      mesh.draw(gl, {
        size  : [this.width, this.height],
        image : new webgl.Texture(0, this.task.output.texture)
      });
    }
  }

  let DownSampleTask = exports.DownSampleTask = class DownSampleTask extends ProcessTask {
    static getShaders() {
      return {};
    }
    
    static getRuntimeShader() {
      return {
        main : {
          attributes : ["pos"],
          vertex : `
precision mediump float;

uniform vec2 size;
uniform sampler2D image;
attribute vec3 pos;

varying vec2 vPos;
varying vec4 vColor;

void main() {
  vPos = pos.xy*0.5 + 0.5;
  gl_Position = vec4(pos.x, pos.y, 0.0, 1.0);
}
        `,
        
        fragment : `
precision mediump float;
uniform vec2 size;
uniform sampler2D image;
varying vec2 vPos;
varying vec4 vColor;

#define FACTOR _FACTOR_

void main() {
  vec4 sum; 
  
  sum = texture2D(image, vPos.xy);

  //sum[0] = sum[1] = sum[2] = vPos.y >= 0.0 && vPos.y <= 1.0 ? 0.5 : 0.0;
  //sum[3] = 1.0;
  
  gl_FragColor = sum;
}
        `
        }
      };
    }
    
    constructor(task, factor) {
      super();
      
      this.factor = Math.ceil(factor);
      this.task = task;
      
      this.width = Math.ceil(this.task.width / this.factor);
      this.height = Math.ceil(this.task.height / this.factor);
    }
    
    run(gl, process) {
      //make shader program
      if (this.width === 0 || this.height === 0 || this.width === undefined || this.height === undefined) {
        throw new Error("width/height were zero");
      }
      
      let sh = DownSampleTask.getRuntimeShader().main;
      let frag = sh.fragment.replace(/_FACTOR_/g, "" + ~~this.factor);
      
      let program = new getShaderProgram(gl, sh.vertex, frag, ["pos"]);
      
      let fbuf = this.output = new FrameBuffer(this.width, this.height);
      fbuf.bind(gl);
      
      gl.clearColor(0.0, 0.0, 0.3, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      //return;
      
      if (window.x === undefined) window.x = 0;
      if (window.y === undefined) window.y = 0;
      
      let mesh = new simplemesh.SimpleMesh(program);
      let quad = mesh.quad([-1, -1, 0], [-1, 1, 0], [1, 1, 0], [1, -1, 0]);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.task.output.texture);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      
      mesh.draw(gl, {
        size  : [this.width, this.height],
        image : new webgl.Texture(0, this.task.output.texture)
      });
    }
  }

  let UpSampleTask = exports.DownSampleTask = class DownSampleTask extends ProcessTask {
    static getShaders() {
      return {};
    }
    
    static getRuntimeShader() {
      return {
        main : {
          attributes : ["pos"],
          vertex : `
precision mediump float;

uniform vec2 size;
uniform sampler2D image;
attribute vec3 pos;

varying vec2 vPos;
varying vec4 vColor;

void main() {
  vPos = pos.xy*0.5 + 0.5;
  gl_Position = vec4(pos.x, pos.y, 0.0, 1.0);
}
        `,
        
        fragment : `
precision mediump float;
uniform vec2 size;
uniform sampler2D image;
varying vec2 vPos;
varying vec4 vColor;

#define FACTOR _FACTOR_

void main() {
  vec4 sum; 
  
  sum = texture2D(image, vPos.xy);

  //sum[0] = sum[1] = sum[2] = vPos.y >= 0.0 && vPos.y <= 1.0 ? 0.5 : 0.0;
  //sum[3] = 1.0;
  
  gl_FragColor = sum;
}
        `
        }
      };
    }
    
    constructor(task, factor) {
      super();
      
      this.factor = Math.ceil(factor);
      this.task = task;
      
      this.width = Math.ceil(this.task.width * this.factor);
      this.height = Math.ceil(this.task.height * this.factor);
    }
    
    run(gl, process) {
      //make shader program
      if (this.width === 0 || this.height === 0 || this.width === undefined || this.height === undefined) {
        throw new Error("width/height were zero");
      }
      
      let sh = UpSampleTask.getRuntimeShader().main;
      let frag = sh.fragment.replace(/_FACTOR_/g, "" + ~~this.factor);
      
      let program = new getShaderProgram(gl, sh.vertex, frag, ["pos"]);
      
      let fbuf = this.output = new FrameBuffer(this.width, this.height);
      fbuf.bind(gl);
      
      gl.clearColor(0.0, 0.0, 0.3, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      //return;
      
      if (window.x === undefined) window.x = 0;
      if (window.y === undefined) window.y = 0;
      
      let mesh = new simplemesh.SimpleMesh(program);
      let quad = mesh.quad([-1, -1, 0], [-1, 1, 0], [1, 1, 0], [1, -1, 0]);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.task.output.texture);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      
      mesh.draw(gl, {
        size  : [this.width, this.height],
        image : new webgl.Texture(0, this.task.output.texture)
      });
    }
  }
  let Dither8BitTask = exports.Dither8BitTask = class Dither8BitTask extends ProcessTask {
    static getShaders() {
      return {
        main : {
          attributes : ["pos"],
          vertex : `
precision mediump float;

uniform vec2 size;
uniform sampler2D image;
attribute vec3 pos;

varying vec2 vPos;
varying vec4 vColor;

void main() {
  vPos = pos.xy*0.5 + 0.5;
  
  gl_Position = vec4(pos.x, pos.y, 0.0, 1.0);
}
        `,
        
        fragment : `
precision mediump float;
uniform vec2 size;
uniform sampler2D image;
varying vec2 vPos;
varying vec4 vColor;

float rand(vec2 seed) {
  seed = fract(seed + seed*100.0 + seed*0.5);
  
  float f = fract(seed[0]*sqrt(2.0) + seed[1]*sqrt(3.0) + seed[0]*seed[1]*sqrt(7.0));
  //f = fract(sin(f)*3.14159 + sqrt(2.0));
  
  return fract(1.0 / (0.00001 * f + 0.000001));
  
  return f;
}

void main() {
  vec4 color = texture2D(image, vPos);
  
  float r = rand(vPos)*2.0 - 1.0;
  float g = rand(vPos)*2.0 - 1.0;
  float b = rand(vPos)*2.0 - 1.0;
  float a = rand(vPos)*2.0 - 1.0;
  
  color = floor(color*255.0 + vec4(r, g, b, 1.0))/255.0;
  gl_FragColor = color;
}
        `
        }
      };
    }
    
    constructor(task) {
      super();
      
      this.task = task;
      
      this.width = task.width;
      this.height = task.height;
    }
    
    run(gl, process) {
      let fbuf = this.output = new FrameBuffer(this.width, this.height);
      
      fbuf.bind(gl);
      
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      if (window.x === undefined) window.x = 0;
      if (window.y === undefined) window.y = 0;
      
      let mesh = new simplemesh.SimpleMesh(Dither8BitTask.shaders.main);
      //let quad = mesh.quad([x, y, 0], [x, y+1, 0], [x+1, y+1, 0], [x+1, y, 0]);
      let quad = mesh.quad([-1, -1, 0], [-1, 1, 0], [1, 1, 0], [1, -1, 0]);
      
      let w = this.width, h = this.height;
      //let quad = mesh.quad([0, 0, 0], [0, h, 0], [w, h, 0], [w, 0, 0]);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.task.output.texture);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      
      mesh.draw(gl, {
        size  : [this.width, this.height],
        image : new webgl.Texture(0, this.task.output.texture)
      });
    }
  }
  
  
  let Chainer = exports.Chainer = class Chainer {
    constructor(process) {
      this.process = process;
      this.tasks = [];
    }
    
    bind(task) {
      this.task = task
      this.tasks.length = 0;
      this.tasks.push(task);
      
      return this;
    }
    
    downsample(factor=2) {
      this.tasks.push(new DownSampleTask(this.tasks[this.tasks.length-1], factor));
      return this;
    }
    
    upsample(factor=2) {
      this.tasks.push(new UpSampleTask(this.tasks[this.tasks.length-1], factor));
      return this;
    }
    
    dither_8bit() {
      this.tasks.push(new Dither8BitTask(this.tasks[this.tasks.length-1]));
      return this;
    }
    
    free() {
      this.task = undefined;
      for (let i=0; i<this.tasks.length; i++) {
        this.tasks[i] = 0;
      }
      
      this.tasks.length = 0;
      
      return this;
    }
    
    blur(radius) {
      this.tasks.push(new BlurTask(this.tasks[this.tasks.length-1], radius, 0));
      this.tasks.push(new BlurTask(this.tasks[this.tasks.length-1], radius, 1));
      return this;
    }
    
    run() {
      return this.process._run(this);
    }
  }

  let ImageProcess = exports.ImageProcess = class ImageProcess {
    constructor() {
      this.chainers = new util.cachering(() => new Chainer(this), 64);
    }
    
    compileShaders() {
      let gl = this.gl;
      
      for (let k in exports) {
        let v = exports[k];
        
        if (typeof v != "function" && typeof v != "object") {
          continue;
        }
        
        if (v.getShaders !== undefined && typeof v.getShaders == "function") {
          let shaders = v.getShaders();
          v.shaders = {};
          
          for (let k2 in shaders) {
            let sh = shaders[k2];
            
            v.shaders[k2] = new getShaderProgram(gl, sh.vertex, sh.fragment, sh.attributes);
            v.shaders[k2].init(gl);
          }
          //console.log(shaders);
        }
      }
    }
    
    _run(chain) {
      if (!(chain.task instanceof ImageTask)) {
        throw new Error("chain.task wasn't an ImageTask");
      }
      
      let width = chain.task.width, height = chain.task.height;
      let canvas = this.canvas, gl = this.gl;
      
      canvas.width = width;
      canvas.height = height;
      
      gl.getExtension("OES_texture_float");
      gl.getExtension("OES_texture_float_linear");
      gl.getExtension("WEBGL_color_buffer_float");
      
      let last = undefined;
      
      for (let task of chain.tasks) {
        gl.viewport(0, 0, task.width, task.height);
        task.run(gl, this);
        
        last = task;
      }
      
      width = last.width, height = last.height;
      let image = new ImageData(width, height);
      image.fdata = new Float32Array(width*height*4);
      
      chain.tasks[chain.tasks.length-1].output.bind(gl);
      
      gl.finish();
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, image.fdata);
      
      let fd = image.fdata, id = image.data;
      for (let i=0; i<fd.length; i++) {
        //let f = fd[i]*255.0;
        //id[i] = ~~(f + 2.0*(Math.random()-0.5));
        id[i] = ~~(fd[i]*255);
      }
      
      chain.free();
      
      return image;
    }
    
    image(image) {
      let task = new ImageTask(image);
      
      return this.chainers.next().bind(task);
    }
    
    init() {
      this.canvas = document.createElement("canvas");
      let gl = this.gl = this.canvas.getContext("webgl", {
        UNPACK_COLORSPACE_CONVERSION_WEBGL : "NONE"
      });
      
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.STENCIL_TEST);
      gl.disable(gl.SCISSOR_TEST);
      
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);
      
      this.compileShaders();
      return this;
    }
  };
  
  return exports;
});







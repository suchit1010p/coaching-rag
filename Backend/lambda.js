// Comprehensive polyfills for pdfjs-dist and canvas libraries
// Must be set on both global and globalThis for Node.js compatibility

class DOMMatrixPolyfill {
    constructor(init) {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.e = 0;
        this.f = 0;
        this.m11 = 1;
        this.m12 = 0;
        this.m13 = 0;
        this.m14 = 0;
        this.m21 = 0;
        this.m22 = 1;
        this.m23 = 0;
        this.m24 = 0;
        this.m31 = 0;
        this.m32 = 0;
        this.m33 = 1;
        this.m34 = 0;
        this.m41 = 0;
        this.m42 = 0;
        this.m43 = 0;
        this.m44 = 1;
    }
    multiply() { return new DOMMatrixPolyfill(); }
    inverse() { return new DOMMatrixPolyfill(); }
    translate() { return new DOMMatrixPolyfill(); }
    scale() { return new DOMMatrixPolyfill(); }
    rotate() { return new DOMMatrixPolyfill(); }
    skewX() { return new DOMMatrixPolyfill(); }
    skewY() { return new DOMMatrixPolyfill(); }
    flipX() { return new DOMMatrixPolyfill(); }
    flipY() { return new DOMMatrixPolyfill(); }
    static fromMatrix() { return new DOMMatrixPolyfill(); }
}

class ImageDataPolyfill {
    constructor(data, width, height) {
        this.data = data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data);
        this.width = width;
        this.height = height;
    }
}

class Path2DPolyfill {
    constructor() {
        this.points = [];
    }
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
}

class OffscreenCanvasPolyfill {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
    getContext() { 
        return {
            createLinearGradient: () => ({}),
            createRadialGradient: () => ({}),
            createPattern: () => ({}),
            fillRect: () => {},
            clearRect: () => {},
            fillText: () => {},
            strokeText: () => {},
            fill: () => {},
            stroke: () => {},
            beginPath: () => {},
            closePath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            bezierCurveTo: () => {},
            quadraticCurveTo: () => {},
            arc: () => {},
            arcTo: () => {},
            rect: () => {},
            scale: () => {},
            rotate: () => {},
            translate: () => {},
            transform: () => {},
            setTransform: () => {},
            drawImage: () => {},
            save: () => {},
            restore: () => {},
            fillStyle: '#000000',
            strokeStyle: '#000000',
            lineWidth: 1,
            canvas: { width: this.width, height: this.height }
        };
    }
    convertToBlob() { return Promise.resolve(new Blob()); }
}

// Set polyfills on both global and globalThis
const polyfills = {
    DOMMatrix: DOMMatrixPolyfill,
    ImageData: ImageDataPolyfill,
    Path2D: Path2DPolyfill,
    OffscreenCanvas: OffscreenCanvasPolyfill
};

for (const [name, polyfill] of Object.entries(polyfills)) {
    if (typeof globalThis[name] === 'undefined') {
        globalThis[name] = polyfill;
    }
    if (typeof global[name] === 'undefined') {
        global[name] = polyfill;
    }
}

import "./src/config.js";
import serverlessHttp from "serverless-http";
import { app } from "./src/app.js";
import connectDB from "./src/db/db.js";

// Connect to MongoDB once when Lambda container starts (warm start reuses this)
let isConnected = false;

const connectIfNeeded = async () => {
    if (!isConnected) {
        await connectDB();
        isConnected = true;
    }
};

const serverlessHandler = serverlessHttp(app, {
    binary: [
        "application/octet-stream",
        "application/pdf",
        "image/*",
        "multipart/form-data"
    ]
});

export const handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await connectIfNeeded();
    return serverlessHandler(event, context);
};

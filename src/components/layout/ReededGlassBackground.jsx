import React, { useRef, useEffect } from 'react';

export default function ReededGlassBackground({ imageUrl }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        // ใช้ WebGL1 หรือ 2 ก็ได้ แต่ Code นี้เขียนรองรับ GL2
        const gl = canvas.getContext('webgl2');

        if (!gl) return;

        // --- Shaders ---
        const vertShaderSource = `#version 300 es
        in vec2 a_position;
        in vec2 a_texCoord;
        out vec2 v_texCoord;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }`;

        // Shader ที่ปรับแต่งใหม่เพื่อเลียนแบบภาพตัวอย่าง
        const fragShaderSource = `#version 300 es
        precision highp float;
        
        uniform sampler2D u_image;
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_imageResolution; // Added image resolution
        
        in vec2 v_texCoord;
        out vec4 outColor;

        void main() {
            vec2 uv = v_texCoord;
            
            // 1. Responsive Strips
            float targetStripWidth = 50.0; 
            float strips = max(5.0, floor(u_resolution.x / targetStripWidth));
            
            // 2. Dynamic Motion (Slower Speed as requested) - Reduced from 0.05 to 0.015
            float speed = u_time * 0.015 * (30.0 / strips); 
            float shift = uv.x + speed;
            
            // Calculate Strip ID
            float stripId = floor(shift * strips);
            float stripUV = fract(shift * strips); 

            // Cylindrical Curve
            float curve = (stripUV - 0.5) * 2.0; 
            
            // Distortion Strength
            float refraction = 0.05; 
            
            // Calculate Distortion
            float distOffset = sign(curve) * pow(abs(curve), 2.5) * refraction;
            
            // --- Aspect Ratio Fix (Cover Mode) ---
            float sA = u_resolution.x / u_resolution.y;
            float iA = u_imageResolution.x / u_imageResolution.y;
            
            // Avoid division by zero if iA is missing
            if (iA == 0.0) iA = 1.0; 

            vec2 scale = vec2(1.0);
            if (sA > iA) {
                // Screen is wider than image: Crop height (Fit Width)
                scale.y = iA / sA;
            } else {
                // Screen is taller than image: Crop width (Fit Height)
                scale.x = sA / iA;
            }
            
            // Calculate "Cover" UVs
            vec2 imgUV = (uv - 0.5) * scale + 0.5;
            
            // Apply Distortion to the Image UV
            vec2 distUV = imgUV;
            distUV.x -= distOffset * scale.x; // Scale distortion too to match image scale? Or keep physical?
            // Keep it simple: distUV.x -= distOffset;
            distUV.x -= distOffset;

            // 3. Chromatic Aberration
            float r = texture(u_image, distUV + vec2(0.003, 0.0)).r;
            float g = texture(u_image, distUV).g;
            float b = texture(u_image, distUV - vec2(0.003, 0.0)).b;
            
            // 4. Edges & Highlights
            float edgeDarkness = smoothstep(0.85, 1.0, abs(stripUV - 0.5) * 2.0);
            vec3 col = vec3(r, g, b) * (1.0 - edgeDarkness * 0.4);
            
            // Dynamic Shine
            float shineSpeed = u_time * 0.5;
            float lightPos = 0.3 + sin(shineSpeed + stripId * 0.5) * 0.2; 
            float highlight = smoothstep(0.05, 0.0, abs(stripUV - lightPos)); 
            col += highlight * 0.15; 

            outColor = vec4(col, 1.0);
        }`;

        // --- Compile Helpers (เหมือนเดิม) ---
        function createShader(gl, type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        function createProgram(gl, vert, frag) {
            const program = gl.createProgram();
            gl.attachShader(program, vert);
            gl.attachShader(program, frag);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error(gl.getProgramInfoLog(program));
                gl.deleteProgram(program);
                return null;
            }
            return program;
        }

        const vertShader = createShader(gl, gl.VERTEX_SHADER, vertShaderSource);
        const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragShaderSource);
        const program = createProgram(gl, vertShader, fragShader);

        // --- Attributes & Buffers (เหมือนเดิม) ---
        const positionLoc = gl.getAttribLocation(program, 'a_position');
        const texCoordLoc = gl.getAttribLocation(program, 'a_texCoord');
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
        const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.enableVertexAttribArray(positionLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(texCoordLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

        // --- Texture ---
        const texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

        let imgWidth = 1920; 
        let imgHeight = 1080;

        const image = new Image();
        if (imageUrl) {
            // Add cache-busting timestamp
            const timestamp = new Date().getTime();
            const hasParams = imageUrl.includes('?');
            const cacheBustedUrl = `${imageUrl}${hasParams ? '&' : '?'}t=${timestamp}`;
            
            image.src = cacheBustedUrl;
            image.crossOrigin = "anonymous";
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                imgWidth = image.naturalWidth || image.width;
                imgHeight = image.naturalHeight || image.height;
                
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            };
        }

        const uImageLoc = gl.getUniformLocation(program, 'u_image');
        const uTimeLoc = gl.getUniformLocation(program, 'u_time');
        const uResolutionLoc = gl.getUniformLocation(program, 'u_resolution');
        const uImageResLoc = gl.getUniformLocation(program, 'u_imageResolution');

        let requestID;
        let startTime = performance.now();

        function render() {
            const displayWidth = canvas.clientWidth;
            const displayHeight = canvas.clientHeight;
            if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
                canvas.width = displayWidth;
                canvas.height = displayHeight;
            }
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

            gl.useProgram(program);
            gl.bindVertexArray(vao);

            gl.uniform1i(uImageLoc, 0);
            gl.uniform1f(uTimeLoc, (performance.now() - startTime) / 1000);
            gl.uniform2f(uResolutionLoc, gl.canvas.width, gl.canvas.height);
            gl.uniform2f(uImageResLoc, imgWidth, imgHeight);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
            requestID = requestAnimationFrame(render);
        }

        render();

        return () => {
            cancelAnimationFrame(requestID);
            gl.deleteProgram(program);
        };
    }, [imageUrl]);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />;
}
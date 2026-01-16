import React, { useRef, useEffect } from 'react';

export default function ReededGlassBackground({ imageUrl }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
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

        const fragShaderSource = `#version 300 es
        precision highp float;
        
        uniform sampler2D u_image;
        uniform float u_time;
        uniform vec2 u_resolution;
        
        in vec2 v_texCoord;
        out vec4 outColor;
        
        // Pseudo-random function
        float random(float x) {
            return fract(sin(x) * 43758.5453123);
        }

        void main() {
            vec2 uv = v_texCoord;
            
            // 1. Organic Slow Movement (Background panning behind the glass)
            float move = sin(u_time * 0.1) * 0.02 + cos(u_time * 0.07) * 0.02;
            vec2 movingUV = uv + vec2(move, 0.0);
            
            // 2. Real Reeded Glass Physics
            // High frequency for realistic narrow strips
            float frequency = 150.0; 
            // Strong amplitude for "Displacement Map" look
            float amplitude = 0.008; 
            
            // Calculate cylindrical surface normal (approx)
            float flute = sin(movingUV.x * frequency);
            
            // Refraction: The glass bends light based on the surface slope
            // We distort the X coordinate significantly
            float displacement = flute * amplitude;
            
            vec2 distortedUV = movingUV + vec2(displacement, 0.0);
            
            // 3. Chromatic Aberration (Prism Effect at edges)
            // Stronger aberration where the glass curves most
            float aberStrength = 0.004 + 0.002 * abs(flute);
            
            float r = texture(u_image, distortedUV + vec2(aberStrength, 0.0)).r;
            float g = texture(u_image, distortedUV).g;
            float b = texture(u_image, distortedUV - vec2(aberStrength, 0.0)).b;
            
            // 4. Lighting / Fresnel
            // Highlights on the ridges (where sine wave peaks)
            float highlight = smoothstep(0.9, 1.0, flute) * 0.3;
            // Shadows in the grooves
            float shadow = smoothstep(-1.0, -0.9, flute) * 0.1;
            
            vec3 finalColor = vec3(r,g,b);
            finalColor += highlight;
            finalColor -= shadow;
            
            // Vignette
            float vignette = 1.0 - length(uv - 0.5) * 0.4;
            
            outColor = vec4(finalColor * vignette, 1.0);
        }`;

        // --- Compile Helpers ---
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

        // --- Attributes & Buffers ---
        const positionLoc = gl.getAttribLocation(program, 'a_position');
        const texCoordLoc = gl.getAttribLocation(program, 'a_texCoord');

        // Full screen quad
        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1,
        ]);
        const texCoords = new Float32Array([
            0, 1,
            1, 1,
            0, 0,
            0, 0,
            1, 1,
            1, 0,
        ]);

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
        
        // Placeholder 1x1 pixel while loading
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

        const image = new Image();
        if (imageUrl) {
            image.src = imageUrl;
            image.crossOrigin = "anonymous";
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            };
        } else {
             // Fallback to black if no image
             gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 10, 10, 255]));
        }

        // --- Uniforms ---
        const uImageLoc = gl.getUniformLocation(program, 'u_image');
        const uTimeLoc = gl.getUniformLocation(program, 'u_time');
        const uResolutionLoc = gl.getUniformLocation(program, 'u_resolution');

        // --- Render Loop ---
        let requestID;
        let startTime = performance.now();

        function render() {
            resizeCanvasToDisplaySize(gl.canvas);
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

            gl.useProgram(program);
            gl.bindVertexArray(vao);

            gl.uniform1i(uImageLoc, 0);
            gl.uniform1f(uTimeLoc, (performance.now() - startTime) / 1000);
            gl.uniform2f(uResolutionLoc, gl.canvas.width, gl.canvas.height);

            gl.drawArrays(gl.TRIANGLES, 0, 6);

            requestID = requestAnimationFrame(render);
        }

        render();

        return () => {
            cancelAnimationFrame(requestID);
            gl.deleteProgram(program);
        };
    }, [imageUrl]);

    function resizeCanvasToDisplaySize(canvas) {
        const displayWidth  = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        if (canvas.width  !== displayWidth || canvas.height !== displayHeight) {
            canvas.width  = displayWidth;
            canvas.height = displayHeight;
        }
    }

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />;
}

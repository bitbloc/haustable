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
        
        in vec2 v_texCoord;
        out vec4 outColor;

        void main() {
            vec2 uv = v_texCoord;
            
            // 1. Responsive Strips
            // คำนวณจำนวนริ้วตามความกว้างหน้าจอ เพื่อให้ขนาดริ้วคงที่ (ไม่บีบในมือถือ)
            // เช่น Desktop 1920px -> 38 ริ้ว, Mobile 375px -> 7 ริ้ว
            float targetStripWidth = 50.0; 
            float strips = max(5.0, floor(u_resolution.x / targetStripWidth));
            
            // เพิ่มการเคลื่อนไหวให้กับริ้ว (Dynamic Strips)
            // ปรับความเร็วให้สัมพันธ์กับจำนวนริ้ว เพื่อให้ดูเร็วเท่ากันทุกจอ
            float speed = u_time * 0.05 * (30.0 / strips); 
            float shift = uv.x + speed;
            
            // คำนวณตำแหน่งภายในแต่ละริ้ว (0.0 ถึง 1.0)
            float stripId = floor(shift * strips);
            float stripUV = fract(shift * strips); 

            // 2. สร้างความโค้งแบบทรงกระบอก (Cylindrical Curve)
            // ค่านี้จะทำให้ตรงกลางริ้วป่องออก และขอบริ้วหุบเข้า
            // ใช้ abs() และ pow() เพื่อสร้างความโค้งที่ดูแข็งและชัด (Hard curve)
            float curve = (stripUV - 0.5) * 2.0; // range -1 to 1
            
            // ความแรงของการบิดเบือน (Distortion Strength)
            // ยิ่งค่ามาก ภาพยิ่งแตกออกจากกัน
            float refraction = 0.05; 
            
            // คำนวณ UV ใหม่ตามความโค้ง
            // ใช้ pow(..., 2.0) เพื่อให้ตรงกลางนิ่งๆ แต่ขอบบิดเยอะๆ เหมือนเลนส์
            float distOffset = sign(curve) * pow(abs(curve), 2.5) * refraction;
            
            vec2 distUV = uv;
            distUV.x -= distOffset;

            // 3. Chromatic Aberration (แยกสี RGB)
            // หัวใจสำคัญที่ทำให้ดูเป็น "แก้ว" คือการที่แสงสีแดงกับน้ำเงินหักเหไม่เท่ากัน
            float r = texture(u_image, distUV + vec2(0.003, 0.0)).r;
            float g = texture(u_image, distUV).g;
            float b = texture(u_image, distUV - vec2(0.003, 0.0)).b;
            
            // 4. สร้างเงาที่ขอบริ้ว (Strip Edges)
            // เพื่อให้แต่ละริ้วดูแยกขาดจากกันชัดเจน (เหมือนรูปตัวอย่างที่เส้นดำคมๆ)
            // ขยับเงาตามริ้วด้วย
            float edgeDarkness = smoothstep(0.85, 1.0, abs(stripUV - 0.5) * 2.0);
            // ทำให้ขอบมืดลง
            vec3 col = vec3(r, g, b) * (1.0 - edgeDarkness * 0.4);
            
            // เพิ่ม Specular Highlight (แสงสะท้อนเส้นขาวๆ ตรงกลางริ้ว) เล็กน้อย
            // ให้แสงวิ่งวูบวาบหน่อย (Dynamic Shine)
            float shineSpeed = u_time * 0.5;
            float lightPos = 0.3 + sin(shineSpeed + stripId * 0.5) * 0.2; // แสงขยับไปมาในแต่ละริ้วไม่พร้อมกัน
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

        // --- Texture (เหมือนเดิม) ---
        const texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

        const image = new Image();
        if (imageUrl) {
            // Add cache-busting timestamp to force reload of the texture
            // This fixes the issue where uploading a new background with the same name doesn't update
            const timestamp = new Date().getTime();
            const hasParams = imageUrl.includes('?');
            const cacheBustedUrl = `${imageUrl}${hasParams ? '&' : '?'}t=${timestamp}`;
            
            image.src = cacheBustedUrl;
            image.crossOrigin = "anonymous";
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                // ตั้งค่า Wrap ให้เป็น Clamp เพื่อไม่ให้ขอบภาพซ้ำซ้อนเวลาบิด
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            };
        }

        const uImageLoc = gl.getUniformLocation(program, 'u_image');
        const uTimeLoc = gl.getUniformLocation(program, 'u_time');
        const uResolutionLoc = gl.getUniformLocation(program, 'u_resolution');

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
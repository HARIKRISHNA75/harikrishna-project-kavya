(() => {
    const canvas = document.getElementById("scene");
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
        document.documentElement.classList.add("no-webgl");
        return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const glyphs = ["文", "அ", "అ", "क", "字", "Ω", "م", "ந", "あ", "Б", "A", "ய"];
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frame = 0;
    let activity = 0;
    let lastFrame = 0;

    const stars = Array.from({ length: 75 }, (_, index) => ({
        x: ((index * 7919) % 997) / 997,
        y: ((index * 3571) % 991) / 991,
        radius: 0.35 + ((index * 13) % 9) / 10,
        phase: index * 0.83
    }));

    function resize() {
        const bounds = canvas.getBoundingClientRect();
        width = bounds.width;
        height = bounds.height;
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        draw(performance.now());
    }

    function line(x1, y1, x2, y2, alpha, color = "94, 234, 212") {
        context.strokeStyle = `rgba(${color}, ${alpha})`;
        context.lineWidth = 0.7;
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
    }

    function drawCore(time) {
        const centerX = width * 0.5;
        const centerY = height * (width < 760 ? 0.31 : 0.3);
        const radius = Math.min(82, width * 0.105);
        const rotation = time * 0.00016;
        const points = [];

        for (let latIndex = 0; latIndex <= 8; latIndex += 1) {
            const latitude = -Math.PI / 2 + latIndex * Math.PI / 8;
            const row = [];
            for (let lonIndex = 0; lonIndex < 16; lonIndex += 1) {
                const longitude = lonIndex * Math.PI / 8 + rotation;
                const x = Math.cos(latitude) * Math.cos(longitude);
                const y = Math.sin(latitude);
                const z = Math.cos(latitude) * Math.sin(longitude);
                const depth = z * Math.cos(0.35) - y * Math.sin(0.35);
                const tiltY = y * Math.cos(0.35) + z * Math.sin(0.35);
                const perspective = 1 + depth * 0.08;
                row.push({
                    x: centerX + x * radius * perspective,
                    y: centerY + tiltY * radius * perspective,
                    depth
                });
            }
            points.push(row);
        }

        const glow = context.createRadialGradient(centerX, centerY, 2, centerX, centerY, radius * 1.4);
        glow.addColorStop(0, "rgba(94, 234, 212, 0.52)");
        glow.addColorStop(0.68, "rgba(41, 174, 159, 0.28)");
        glow.addColorStop(1, "rgba(94, 234, 212, 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(centerX, centerY, radius * 1.4, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "rgba(53, 194, 174, 0.34)";
        context.beginPath();
        context.arc(centerX, centerY, radius * 0.67, 0, Math.PI * 2);
        context.fill();

        for (let rowIndex = 0; rowIndex < points.length; rowIndex += 1) {
            const row = points[rowIndex];
            for (let column = 0; column < row.length; column += 1) {
                const point = row[column];
                const nextColumn = row[(column + 1) % row.length];
                line(point.x, point.y, nextColumn.x, nextColumn.y, 0.18 + (point.depth + 1) * 0.12);
                if (rowIndex < points.length - 1) {
                    const below = points[rowIndex + 1][column];
                    line(point.x, point.y, below.x, below.y, 0.18 + (point.depth + 1) * 0.12);
                }
            }
        }

        context.strokeStyle = `rgba(94, 234, 212, ${0.22 + activity * 0.22})`;
        context.lineWidth = 1;
        context.beginPath();
        context.ellipse(centerX, centerY, radius * 1.55, radius * 0.48, -0.15, 0, Math.PI * 2);
        context.stroke();

        return { centerX, centerY, radius };
    }

    function drawDocument(x, y, angle, scale, color, time) {
        context.save();
        context.translate(x, y + Math.sin(time * 0.001 + x) * 6);
        context.rotate(angle);
        context.scale(scale, scale);
        context.fillStyle = color;
        context.strokeStyle = "rgba(190, 219, 228, 0.42)";
        context.lineWidth = 0.7;
        context.fillRect(-12, -20, 24, 40);
        context.strokeRect(-12, -20, 24, 40);
        for (let row = 0; row < 5; row += 1) {
            line(-7, -12 + row * 6, 7 - (row % 2) * 3, -12 + row * 6, 0.4, "220, 244, 241");
        }
        context.restore();
    }

    function draw(time) {
        if (!width || !height) return;
        context.clearRect(0, 0, width, height);

        for (const star of stars) {
            const shimmer = 0.2 + (Math.sin(time * 0.001 + star.phase) + 1) * 0.2;
            context.fillStyle = `rgba(190, 219, 228, ${shimmer})`;
            context.beginPath();
            context.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
            context.fill();
        }

        const { centerX, centerY, radius } = drawCore(time);
        const orbit = radius * 1.95;
        const documentAngle = time * 0.00022;
        drawDocument(centerX - orbit * 1.55, centerY + radius * 0.38, -0.2, 1, "rgba(94, 234, 212, 0.75)", time);
        drawDocument(centerX + orbit * 1.45, centerY + radius * 0.22, 0.12, 0.9, "rgba(133, 188, 224, 0.55)", time);
        drawDocument(
            centerX + Math.cos(documentAngle) * orbit * 1.1,
            centerY + Math.sin(documentAngle) * orbit * 0.75,
            -0.13,
            0.7,
            "rgba(181, 167, 224, 0.45)",
            time
        );

        glyphs.forEach((glyph, index) => {
            const angle = time * 0.0001 + index * (Math.PI * 2 / glyphs.length);
            const x = centerX + Math.cos(angle) * orbit * (1.7 + index % 3 * 0.3);
            const y = centerY + Math.sin(angle * 1.4) * radius * 1.8;
            context.fillStyle = `rgba(${index % 2 ? "167, 139, 250" : "94, 234, 212"}, 0.48)`;
            context.font = "600 14px system-ui, sans-serif";
            context.fillText(glyph, x, y);
        });

        activity *= 0.985;
    }

    function animate(time) {
        if (time - lastFrame >= 1000 / 30) {
            draw(time);
            lastFrame = time;
        }
        frame = window.requestAnimationFrame(animate);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("rag:upload-start", () => { activity = 1; });
    window.addEventListener("rag:query-start", () => { activity = 1; });
    window.addEventListener("rag:indexed", () => { activity = 0.7; });
    resize();
    if (!reduceMotion) {
        frame = window.requestAnimationFrame(animate);
    }
    window.addEventListener("pagehide", () => window.cancelAnimationFrame(frame), { once: true });
})();

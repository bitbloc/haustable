import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';

/**
 * KineticChar
 * Individual character component that reacts to mouse proximity.
 */
const KineticChar = ({ char, mouseX, mouseY, parentRef, baseWeight = 100, baseWidth = 100 }) => {
    const charRef = useRef(null);
    const [center, setCenter] = useState({ x: 0, y: 0 });

    // Update center position on mount and resize
    useEffect(() => {
        const updateCenter = () => {
            if (charRef.current) {
                const rect = charRef.current.getBoundingClientRect();
                setCenter({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                });
            }
        };

        updateCenter();
        window.addEventListener('resize', updateCenter);
        return () => window.removeEventListener('resize', updateCenter);
    }, []);

    // Calculate distance from mouse to this character center
    // We use a transform to map distance to font variation settings
    const distanceInfo = useTransform(() => {
        if (!charRef.current) return { weight: baseWeight, width: baseWidth };

        const mX = mouseX.get();
        const mY = mouseY.get();

        // If mouse is at 0,0 (initial or left), reset
        if (mX === 0 && mY === 0) return { weight: baseWeight, width: baseWidth };

        const dx = mX - center.x;
        const dy = mY - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Interaction Radius: 150px
        const maxDist = 250;

        if (dist > maxDist) return { weight: baseWeight, width: baseWidth };

        // Normalize distance (0 = close, 1 = far)
        const normalize = 1 - (dist / maxDist);

        // Easing to make it feel more "magnetic"
        const eased = normalize * normalize;

        // Map to Variable Font Axis
        // Weight: 100 -> 900
        // Width: 25 -> 151 (Roboto Flex limits)

        const targetWeight = baseWeight + (eased * (900 - baseWeight)); // Max weight 900
        const targetWidth = baseWidth + (eased * (151 - baseWidth));   // Max width 151

        return { weight: targetWeight, width: targetWidth };
    });

    // We render this value into a CSS string for style
    // We use a spring on top of the plain value for smoother transitions? 
    // Actually, directly mapping form the mouseSpring is smoothest for "physics" feel.

    // However, useTransform returns a MotionValue, we need to extract it for the style.
    // Framer motion 'style' prop can take MotionValues directly.

    // Let's create specific MotionValues for weight and width to avoid returning an object
    const weight = useTransform(distanceInfo, (info) => info.weight);
    const width = useTransform(distanceInfo, (info) => info.width);

    return (
        <motion.span
            ref={charRef}
            className="inline-block origin-bottom"
            style={{
                fontVariationSettings: useTransform(
                    [weight, width],
                    ([w, wd]) => `'wght' ${w}, 'wdth' ${wd}`
                ),
                // Optional: color shift or other effects
            }}
        >
            {char === ' ' ? '\u00A0' : char}
        </motion.span>
    );
};


/**
 * KineticText Component
 * Handles the "Reveal" animation and distributes KineticChar children.
 */
const KineticText = ({
    text = "HAUS TABLE",
    className = "",
    baseWeight = 400,
    baseWidth = 100,
    highlight = false // If true, applies specific styling for "OPEN" state
}) => {
    const containerRef = useRef(null);

    // Global Mouse Handling for the component area
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth mouse using spring
    const smoothMouseX = useSpring(mouseX, { damping: 20, stiffness: 150 });
    const smoothMouseY = useSpring(mouseY, { damping: 20, stiffness: 150 });

    useEffect(() => {
        // Desktop: Mouse Move
        const handleMouseMove = (e) => {
            mouseX.set(e.clientX);
            mouseY.set(e.clientY);
        };

        // Mobile: Gyroscope (Device Orientation)
        const handleOrientation = (e) => {
            // Check if sensor data is available
            if (e.gamma === null || e.beta === null) return;

            // Gamma: Left to Right tilt (-90 to 90)
            // Beta: Front to Back tilt (-180 to 180). Normal holding pos is around 45deg (upright-ish)

            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            // Sensitivity multiplier
            const amp = 15;

            // Calc virtual X offset based on Gamma (Tilt L/R)
            // If gamma is 0 (flat), offset is 0. If -20 (left), move left.
            const offsetX = e.gamma * amp;

            // Calc virtual Y offset based on Beta (Tilt F/B)
            // We subtract 45 to center the effect around a natural holding angle
            const offsetY = (e.beta - 45) * amp;

            // Clamp values to screen bounds (optional, but keeps it sane)
            const targetX = Math.min(Math.max(centerX + offsetX, 0), window.innerWidth);
            const targetY = Math.min(Math.max(centerY + offsetY, 0), window.innerHeight);

            mouseX.set(targetX);
            mouseY.set(targetY);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('deviceorientation', handleOrientation);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, [mouseX, mouseY]);


    // Reveal Animation (Scroll Trigger)
    // We want the text to "rise" from a line-masked state
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "center center"]
    });

    // Reveal Logic: Text starts "y: 100%" (hidden down) and moves to "0%"
    // But since it's a "Hero" text, might also want an initial load animation.
    // Let's combine standard initial animation with scroll effects if needed.
    // For now, simpler "in-view" trigger with framer motion `whileInView` is often more robust for specific sections.

    const words = text.split(" ");

    return (
        <motion.div
            ref={containerRef}
            className={`cursor-default select-none relative z-10 font-[Roboto_Flex] ${className}`}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-10%" }}
            variants={{
                visible: { transition: { staggerChildren: 0.1 } },
                hidden: {}
            }}
        >
            <div className="flex flex-wrap justify-center overflow-hidden leading-none -mx-4">
                {/* Added a negative margin wrapper to handle word spacing better if needed, but flex gap is safer */}
                {words.map((word, i) => (
                    <div key={i} className="overflow-hidden mx-1 md:mx-2 px-2 py-4 -my-4"> {/* Masking Container with padding to prevent char crop */}
                        <motion.div
                            variants={{
                                hidden: { y: "100%" },
                                visible: {
                                    y: "0%",
                                    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
                                }
                            }}
                            className="flex"
                        >
                            {Array.from(word).map((char, j) => (
                                <KineticChar
                                    key={j}
                                    char={char}
                                    mouseX={smoothMouseX}
                                    mouseY={smoothMouseY}
                                    parentRef={containerRef}
                                    baseWeight={baseWeight}
                                    baseWidth={baseWidth}
                                />
                            ))}
                        </motion.div>
                    </div>
                ))}
            </div>

            {/* Decorative Line that also animates? */}
            <motion.div
                className={`h-[2px] w-full mt-2 origin-left ${highlight ? 'bg-[#DFFF00]' : 'bg-current'}`}
                variants={{
                    hidden: { scaleX: 0 },
                    visible: { scaleX: 1, transition: { duration: 1, delay: 0.5, ease: "easeOut" } }
                }}
            />
        </motion.div>
    );
};

export default KineticText;

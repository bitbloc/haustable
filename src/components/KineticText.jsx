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

    // State for iOS Permission
    const [permissionGranted, setPermissionGranted] = useState(false);

    // Smooth mouse using spring
    const smoothMouseX = useSpring(mouseX, { damping: 20, stiffness: 150 });
    const smoothMouseY = useSpring(mouseY, { damping: 20, stiffness: 150 });

    useEffect(() => {
        let animationFrame;
        let lastInteraction = 0;

        // Idle Animation Loop
        const animateIdle = () => {
            const now = Date.now();
            // If no interaction for 2 seconds, assume idle
            if (now - lastInteraction > 2000) {
                // Idle Mode: Gentle "Breathing" / Figure-8 pattern
                // We use a slow timer
                const time = now / 3000;
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;

                // Radius
                const rx = Math.min(window.innerWidth * 0.2, 200);
                const ry = Math.min(window.innerHeight * 0.1, 100);

                // Figure-8: x = sin(t), y = sin(2t)
                const targetX = centerX + Math.sin(time) * rx;
                const targetY = centerY + Math.sin(time * 2) * ry;

                mouseX.set(targetX);
                mouseY.set(targetY);
            }
            animationFrame = requestAnimationFrame(animateIdle);
        };
        animationFrame = requestAnimationFrame(animateIdle);


        const handleMouseMove = (e) => {
            lastInteraction = Date.now();
            mouseX.set(e.clientX);
            mouseY.set(e.clientY);
        };

        const handleOrientation = (e) => {
            if (e.gamma === null || e.beta === null) return;

            lastInteraction = Date.now();

            // Gamma: Left/Right -90 to 90
            // Beta: Front/Back -180 to 180
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            const amp = 15;

            const offsetX = e.gamma * amp;
            const offsetY = (e.beta - 45) * amp;

            const targetX = Math.min(Math.max(cx + offsetX, 0), window.innerWidth);
            const targetY = Math.min(Math.max(cy + offsetY, 0), window.innerHeight);

            mouseX.set(targetX);
            mouseY.set(targetY);
        };

        window.addEventListener('mousemove', handleMouseMove);
        // Only active if device supports it (implicit or permission granted)
        window.addEventListener('deviceorientation', handleOrientation);

        return () => {
            cancelAnimationFrame(animationFrame);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, [mouseX, mouseY]);

    // iOS 13+ Permission Requirement
    const requestAccess = () => {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        setPermissionGranted(true);
                    }
                })
                .catch(e => console.log(e));
        }
    };


    // Reveal Animation (Scroll Trigger)
    // We want the text to "rise" from a line-masked state
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "center center"]
    });

    const words = text.split(" ");

    return (
        <motion.div
            ref={containerRef}
            onClick={requestAccess}
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

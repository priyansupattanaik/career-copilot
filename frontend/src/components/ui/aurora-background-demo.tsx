"use client";

import { motion } from "motion/react";
import { AuroraBackground } from "@/components/ui/aurora-background";

export default function AuroraBackgroundDemo() {
  return (
    <AuroraBackground>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
        className="aurora-background-demo-content"
      >
        <p className="eyebrow">Career Copilot</p>
        <h1>Build confidence before the interview.</h1>
      </motion.div>
    </AuroraBackground>
  );
}

"use client";

import { useEffect } from "react";
import { closeActionAlert, showActionAlert } from "@/lib/actionAlerts";

export default function ActionMessage({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return;
    let active = true;
    showActionAlert({ icon: message.icon || "success", titleText: message.title, text: message.text })
      .then(() => { if (active) onDismiss(); });
    return () => { active = false; closeActionAlert(); };
  }, [message, onDismiss]);
  return null;
}

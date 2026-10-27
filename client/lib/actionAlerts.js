"use client";

import Swal from "sweetalert2/dist/sweetalert2.js";

export function showActionAlert(options) {
  return Swal.fire({
    target: document.querySelector("dialog[open]") || document.body,
    background: "var(--surface)",
    color: "var(--foreground)",
    confirmButtonText: "Got It",
    buttonsStyling: false,
    heightAuto: false,
    scrollbarPadding: false,
    returnFocus: true,
    keydownListenerCapture: true,
    customClass: {
      popup: "rounded-panel! border! border-border! font-sans!",
      title: "text-xl! font-semibold!",
      htmlContainer: "text-sm! leading-relaxed! text-text-secondary!",
      confirmButton: "ui-button",
      cancelButton: "ui-button bg-surface! text-text-secondary! border-border-strong! ml-3!",
    },
    ...options,
  });
}

export function confirmDelete(name, label) {
  return showActionAlert({
    icon: "warning",
    titleText: `Delete ${label}?`,
    text: `${name}’s account will be permanently deleted. This cannot be undone.`,
    showCancelButton: true,
    confirmButtonText: "Delete Account",
    cancelButtonText: "Cancel",
    focusCancel: true,
    didOpen: () => {
      const button = Swal.getConfirmButton();
      button.dataset.variant = "danger";
    },
  });
}

export function closeActionAlert() { Swal.close(); }

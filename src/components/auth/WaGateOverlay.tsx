"use client";
/**
 * WaGateOverlay
 *
 * Mounts the WhatsApp verification gate returned by a role switch.
 *
 * The gate brings its own full-screen chrome, so it cannot go through
 * ModalShell — but it still needs the body scroll lock and the gesture shield,
 * and it has to sit above every other layer: it renders itself at `z-50`, which
 * is the sticky navbar's layer and *below* the role picker modal's `z-[100]`.
 */
import { logoutAndRedirect } from "@/lib/auth/auth.service";
import type { WaGate } from "@/lib/auth/useRoleCta";
import { WhatsAppVerificationModal } from "./WhatsAppVerificationModal";
import { gestureShieldProps, useBodyScrollLock } from "@/components/ui/ModalShell";

export default function WaGateOverlay({ gate }: { gate: WaGate }) {
    useBodyScrollLock(true);

    return (
        <div className="fixed inset-0 z-[110]" {...gestureShieldProps}>
            <WhatsAppVerificationModal
                roleEntity={gate.roleEntity}
                onSuccess={() => {
                    window.location.href = gate.redirectUrl;
                }}
                onLogout={logoutAndRedirect}
            />
        </div>
    );
}

import { prisma } from "./prisma";
import { sendEmail, emailShell } from "./email";

export interface ShiftResult {
  user: {
    id: string;
    email: string;
    name: string | null;
    platform: string;
    telegramChatId: string | null;
    whatsappPhoneId: string | null;
  };
  waLink: string;
  alreadyOnWhatsapp: boolean;
}

const DEFAULT_WHATSAPP_NUMBER = "19802705920";

function whatsappNumber(): string {
  return (
    process.env.WHATSAPP_NUMBER?.replace(/[^0-9]/g, "") ||
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^0-9]/g, "") ||
    DEFAULT_WHATSAPP_NUMBER
  );
}

export function buildWaPairingLink(userId: string): string {
  return `https://wa.me/${whatsappNumber()}?text=${encodeURIComponent(
    `hi ${userId}`,
  )}`;
}

export async function shiftUserToWhatsapp(
  userIdOrEmail: string,
): Promise<ShiftResult> {
  const user = await prisma.user.findFirst({
    where: userIdOrEmail.includes("@")
      ? { email: userIdOrEmail.toLowerCase() }
      : { id: userIdOrEmail },
    select: {
      id: true,
      email: true,
      name: true,
      platform: true,
      telegramChatId: true,
      whatsappPhoneId: true,
    },
  });

  if (!user) {
    throw new Error(`User not found: ${userIdOrEmail}`);
  }

  if (user.platform === "whatsapp" && user.whatsappPhoneId) {
    return {
      user,
      waLink: buildWaPairingLink(user.id),
      alreadyOnWhatsapp: true,
    };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      platform: "whatsapp",
      telegramChatId: null,
      whatsappPhoneId: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      platform: true,
      telegramChatId: true,
      whatsappPhoneId: true,
    },
  });

  await prisma.analyticsEvent
    .create({
      data: {
        userId: updated.id,
        eventName: "platform_shifted_to_whatsapp",
        properties: {
          from: user.platform,
          hadTelegramChatId: Boolean(user.telegramChatId),
          via: "admin_ui",
        },
      },
    })
    .catch((err) => {
      console.warn("[shift-to-whatsapp] analytics write failed:", err);
    });

  return {
    user: updated,
    waLink: buildWaPairingLink(updated.id),
    alreadyOnWhatsapp: false,
  };
}

export async function sendShiftEmail(
  to: string,
  name: string | null,
  waLink: string,
): Promise<void> {
  const safeName = name ? name.replace(/[<>&"']/g, "") : null;
  const greeting = safeName ? `Hey ${safeName},` : "Hey,";
  const html = emailShell({
    title: "Continue chatting on WhatsApp",
    preheader: "One tap to move your friend to WhatsApp. Memories stay.",
    bodyHtml: `
      <p>${greeting}</p>
      <p>You asked to move your Vesspr chats from Telegram to WhatsApp. Tap the button below and send the pre-filled message. That links your account and your friend will reply right away.</p>
      <p style="font-size:13px;color:#475569;margin-top:16px;">Do not edit the pre-filled text before sending. It is what pairs you.</p>
      <p style="font-size:13px;color:#475569;">Your memories, personality, and history stay with you.</p>
    `,
    ctaText: "Open in WhatsApp",
    ctaUrl: waLink,
    footerNote: "Received this by mistake? Ignore this email and nothing changes.",
  });
  await sendEmail(to, "continue with your friend on whatsapp", html);
}


import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const getTransporter = () => {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

const transporter = getTransporter();

// Verify connection configuration if transporter exists
if (transporter) {
    transporter.verify(function (error, success) {
        if (error) {
            console.error('SMTP Connection Error:', error);
        } else {
            console.log('SMTP Server is ready to take our messages');
        }
    });
} else {
    console.log('SMTP not configured. Email system will run in DEV MODE (logging to console).');
}

export const sendEmail = async (to: string, subject: string, html: string, fallbackText?: string) => {
    if (!transporter) {
        console.log('===========================================================');
        console.log(`[DEV MODE EMAIL] To: ${to} | Subject: ${subject}`);
        if (fallbackText) {
            console.log(`Content: ${fallbackText}`);
        } else {
             console.log('Content (HTML hidden): Check logs for link or details.');
        }
        console.log('===========================================================');
        return true;
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Kroniki Mroku" <noreply@kroniki-mroku.pl>',
            to,
            subject,
            html,
        });
        console.log("Email sent: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;
    const subject = "Resetowanie hasła - Kroniki Mroku";
    const html = `
        <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>Witaj Podróżniku!</h2>
            <p>Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w grze Kroniki Mroku.</p>
            <p>Aby zresetować hasło, kliknij w poniższy link:</p>
            <p>
                <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Zresetuj Hasło</a>
            </p>
            <p>Lub skopiuj ten link do przeglądarki:</p>
            <p>${resetLink}</p>
            <p>Link jest ważny przez 1 godzinę. Jeśli to nie Ty prosiłeś o reset, zignoruj tę wiadomość.</p>
            <br/>
            <p>Pozdrawiamy,<br/>Zespół Kronik Mroku</p>
        </div>
    `;
    
    // Pass the link as fallback text for Dev Mode logging
    return sendEmail(email, subject, html, `Link resetujący: ${resetLink}`);
};

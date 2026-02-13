import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendVerificationEmail = async (email, name, verificationUrl, batchName, mobile, password) => {
    try {
        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: email,
            subject: 'Welcome to BG Group Tuition! Verify Your Email',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            background-color: #f4f4f4;
                            margin: 0;
                            padding: 0;
                            line-height: 1.6;
                            color: #333;
                        }
                        .container {
                            max-width: 600px;
                            margin: 20px auto;
                            background-color: #ffffff;
                            border-radius: 8px;
                            overflow: hidden;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        }
                        .header {
                            background-color: #4f46e5; /* Indigo-600 */
                            color: #ffffff;
                            padding: 30px 20px;
                            text-align: center;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 24px;
                            font-weight: 600;
                        }
                        .content {
                            padding: 40px 30px;
                        }
                        .greeting {
                            font-size: 18px;
                            margin-bottom: 20px;
                        }
                        .message {
                            margin-bottom: 30px;
                        }
                        .details-box {
                            background-color: #f9fafb;
                            border: 1px solid #e5e7eb;
                            border-radius: 6px;
                            padding: 20px;
                            margin-bottom: 30px;
                        }
                        .detail-row {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 10px;
                            border-bottom: 1px solid #eee;
                            padding-bottom: 10px;
                        }
                        .detail-row:last-child {
                            border-bottom: none;
                            margin-bottom: 0;
                            padding-bottom: 0;
                        }
                        .label {
                            font-weight: 600;
                            color: #6b7280;
                        }
                        .value {
                            font-weight: 500;
                            color: #111827;
                        }
                        .btn-container {
                            text-align: center;
                            margin: 30px 0;
                        }
                        .btn {
                            background-color: #4f46e5;
                            color: #ffffff !important;
                            padding: 12px 30px;
                            text-decoration: none;
                            border-radius: 6px;
                            font-weight: 600;
                            display: inline-block;
                            transition: background-color 0.3s;
                        }
                        .btn:hover {
                            background-color: #4338ca;
                        }
                        .footer {
                            background-color: #f9fafb;
                            padding: 20px;
                            text-align: center;
                            font-size: 14px;
                            color: #6b7280;
                            border-top: 1px solid #e5e7eb;
                        }
                        .link-fallback {
                            font-size: 12px;
                            color: #9ca3af;
                            word-break: break-all;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Welcome to BG Group Tuition</h1>
                        </div>
                        <div class="content">
                            <p class="greeting">Hello <strong>${name}</strong>,</p>
                            <p class="message">We are excited to have you join us! Your registration was successful. Below are your enrollment details and login credentials.</p>
                            
                            <div class="details-box">
                                <div class="detail-row">
                                    <span class="label">Batch Name:</span>
                                    <span class="value"> ${batchName}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Mobile Number: </span>
                                    <span class="value"> ${mobile}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Password: </span>
                                    <span class="value"> ${password}</span>
                                </div>
                            </div>
                            
                            <p>To complete your registration and activate your account, please verify your email address.</p>
                            
                            <div class="btn-container">
                                <a href="${verificationUrl}" class="btn">Verify Email Address</a>
                            </div>

                            <p class="link-fallback" style="text-align: center;">
                                If the button above doesn't work, copy and paste this link into your browser:<br>
                                <a href="${verificationUrl}" style="color: #4f46e5;">${verificationUrl}</a>
                            </p>
                        </div>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} BG Group Tuition Classes. All rights reserved.</p>
                            <p>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Verification email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending verification email:', error);
        return null;
    }
};

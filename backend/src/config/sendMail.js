import { createTransport } from "nodemailer";

const sendMail = async ({ email, subject, html }) => {
  const transport = createTransport({
    host: "stmp.gmail.com",
    port: 465,
    auth: {
      user: "randamstring",
      pass: "pass",
    },
  });

  await transport.sendMail({
    from: "randamstring",
    to: email,
    subject,
    html,
  });
};


export default sendMail;

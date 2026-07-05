declare module "nodemailer" {
  type MailOptions = {
    from?: string;
    to?: string;
    subject?: string;
    html?: string;
  };

  type Transporter = {
    sendMail(options: MailOptions): Promise<unknown>;
  };

  export function createTransport(options: unknown): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };

  export default nodemailer;
}

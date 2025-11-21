function die(msg: string): never {
  throw new Error(msg);
}

export default {
  port: Number(process.env.PIMBL_PORT || 4000),
  mapscoApiKey: process.env.PIMBL_MAPSCO_API_KEY,
  twoCaptchaApiKey: process.env.PIMBL_2CAPTCHA_API_KEY || die("PIMBL_2CAPTCHA_API_KEY not set"),
  noSubmit: !!process.env.PIMBL_NO_SUBMIT,
  linger: !!process.env.PIMBL_LINGER,
};

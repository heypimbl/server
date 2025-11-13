export default {
  port: Number(process.env.PIMBL_PORT || 4000),
  mapscoApiKey: process.env.PIMBL_MAPSCO_API_KEY,
  noSubmit: !!process.env.PIMBL_NO_SUBMIT,
  linger: !!process.env.PIMBL_LINGER,
};

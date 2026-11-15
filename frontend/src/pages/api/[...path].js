import expressHandler from '../../../../backend/api/index.js';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default expressHandler;

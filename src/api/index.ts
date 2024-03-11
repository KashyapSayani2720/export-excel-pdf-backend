import express from 'express';

import MessageResponse from '../interfaces/MessageResponse';
import excel_data from './excel_data';
import address_accuracy from './address_accuracy';

const router = express.Router();

router.get<{}, MessageResponse>('/', (req, res) => {
  res.json({
    message: 'API - 👋🌎🌍🌏',
  });
});

router.use('/excel', excel_data);
router.use('/address', address_accuracy);

export default router;

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { getNetworkStockList } from '../services/networkStockService';
import { getAfaStock } from '../services/afaStockService';
import { getAllCheckerStock } from '../services/checkerStockService';
import { CHECKER_DEFAULT_IMAGE } from '../config/checker';

const router = Router();

/** Public platform service availability for marketing homepage. */
router.get('/services', asyncHandler(async (_req, res) => {
  const [networks, afa, checkerStock] = await Promise.all([
    getNetworkStockList(),
    getAfaStock(),
    getAllCheckerStock(),
  ]);

  res.json({
    success: true,
    data: {
      networks: networks.map((n) => ({
        network: n.network,
        inStock: n.inStock,
      })),
      afa: {
        inStock: afa.inStock,
        imageUrl: afa.imageUrl || '/images/afa.jpg',
      },
      checker: {
        inStock: checkerStock.some((s) => s.inStock),
        imageUrl: CHECKER_DEFAULT_IMAGE,
        bece: { inStock: checkerStock.find((s) => s.type === 'bece')?.inStock ?? false },
        wassce: { inStock: checkerStock.find((s) => s.type === 'wassce')?.inStock ?? false },
      },
    },
  });
}));

export default router;

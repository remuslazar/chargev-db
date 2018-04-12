import {Router, Request, Response} from 'express';

const router: Router = Router();

router.get('/', (req: Request, res: Response) => {
  res.render('index', {
  })
});

// Export the express.Router() instance to be used by server.ts
export const rootController: Router = router;

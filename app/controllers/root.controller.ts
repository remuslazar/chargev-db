import {Router, Request, Response} from 'express';

const router: Router = Router();

router.get('/', (req: Request, res: Response) => {
  res.render('index.pug', {
  });
});

// Export the express.Router() instance to be used by app.ts
export const rootController: Router = router;

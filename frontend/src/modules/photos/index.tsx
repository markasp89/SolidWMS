import type { AppModule } from '@/core/modules/types'
import { LocationPhotoAction, PalletPhotos, ProductPhotos } from './extensions'

export const photosModule: AppModule = {
  key: 'photos',
  extensions: {
    'product.sidebar': ProductPhotos,
    'pallet.sidebar': PalletPhotos,
    'location.actions': LocationPhotoAction,
  },
}


import { Size } from '../Common/models';

class drawingHelper {
    private static bgImageSize: Size = { width: 0, height: 0 };

    /**
     * 让 helper 类知道背景图片的大小
     * @param width 图片宽度
     * @param height 图片高度
     */
    public static SetBgImageSize = (width: number, height: number) => {
        drawingHelper.bgImageSize.width = width;
        drawingHelper.bgImageSize.height = height;
    }
}


export const useDrawingHelper = () => {
    return drawingHelper;
}
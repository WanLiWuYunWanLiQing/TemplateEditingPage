import type Konva from 'konva';
import { isNumber } from 'lodash-es';
import { type Vector2d } from 'konva/lib/types';
import { type Point } from '@compass/common/models/vision';

class DrawingCanvasHelper {
  /**
   * 绘图层引用
   */
  public static layerEnv: Konva.Layer | null;
  /**
   * 背景图片的缩放系数
   */
  public static baseScale: number;
  public static lastPoint: Point = { x: 0, y: 0 };
  /**
   * 被选中的掩膜
   */
  public static selectedPath: Konva.Path;
  // public static readonly PolyBool = require('polybooljs');

  /**
   * 将一个数字限定在指定的范围内
   * @param value 需要处理的原始值
   * @param min 允许的最小值
   * @param max 允许的最大值
   */
  public static clampNumber(value: number, min: number, max: number): number {
    if (min > max) {
      const temp = min;
      min = max;
      max = temp;
    }
    return Math.max(min, Math.min(max, value));
  }

  /**
   * 将一个坐标限定在指定的矩形范围内
   * @param value 需要处理的原始值
   * @param minPoint 限制点1,默认使用（0，0）
   * @param maxPoint 限制点2(可选),不选代表只限制value的最小值
   */
  public static clampPoint(
    value: Point | { width: number; height: number },
    minPoint: Point | { width: number; height: number } = { x: 0, y: 0 },
    maxPoint?: Point | { width: number; height: number }
  ): Point {
    maxPoint = maxPoint ?? value;
    if ('width' in value) {
      value = { x: value.width, y: value.height };
    }
    if ('width' in minPoint) {
      minPoint = { x: minPoint.width, y: minPoint.height };
    }
    if ('width' in maxPoint) {
      maxPoint = { x: maxPoint.width, y: maxPoint.height };
    }
    if (minPoint.x > maxPoint.x) {
      const temp = minPoint.x;
      minPoint.x = maxPoint.x;
      maxPoint.x = temp;
    }
    if (minPoint.y > maxPoint.y) {
      const temp = minPoint.y;
      minPoint.y = maxPoint.y;
      maxPoint.y = temp;
    }
    return {
      x: Math.max(minPoint.x, Math.min(maxPoint.x, value.x)),
      y: Math.max(minPoint.y, Math.min(maxPoint.y, value.y))
    };
  }

  /**
   * 在layer和stage之间转换坐标
   * @param value 需要处理的原始值
   * @param convert2Layer 坐标转换方向（默认StageToLayer）
   */
  public static convertStageToLayerCoord(
    value: Point | { width: number; height: number },
    convert2Layer = true
  ): Point {
    let res;
    if ('width' in value) {
      value = { x: value.width, y: value.height };
    }
    const offset = this.layerEnv?.position() ?? { x: 0, y: 0 };
    const scale = this.layerEnv?.scaleX() ?? 1;
    if (convert2Layer) {
      res = this.customDivide(this.customSubtract(value, offset), scale);
    } else {
      res = this.customAdd(this.customMultiply(value, scale), offset);
    }
    if (res instanceof Error) {
      throw res;
    } else {
      return res;
    }
  }

  /**
   * 屏幕坐标与物理坐标的转换
   * @param value 需要处理的原始值(点在layer上的坐标值或物理坐标)；
   *              需要注意有的坐标是基于stage的，需要转换为layer坐标系坐标
   * @param convert2Physical 坐标转换方向（默认屏幕转物理）
   */
  public static convertLayerToPhysicalCoord(
    value: Point | { width: number; height: number },
    convert2Physical = true
  ): Point {
    let res: Point;
    if ('width' in value) {
      value = { x: value.width, y: value.height };
    }
    if (convert2Physical) {
      // 屏幕坐标（基于layer）转物理坐标（基于模板图片）
      const x = (value.x ?? 0) / this.baseScale;
      const y = (value.y ?? 0) / this.baseScale;
      res = { x, y };
    } else {
      // 物理坐标（基于模板图片）转屏幕坐标（基于layer）
      const x = (value.x ?? 0) * this.baseScale;
      const y = (value.y ?? 0) * this.baseScale;
      res = { x, y };
    }
    return res;
  }

  /**
   * 自定义加法 return {p1.x+p2.x, p1.y+p2.y}
   * @param p1 1
   * @param p2 2
   */
  public static customAdd(
    p1: Point | { width: number; height: number },
    p2: Point | { width: number; height: number }
  ): Point {
    if ('width' in p1) {
      p1 = { x: p1.width, y: p1.height };
    }
    if ('width' in p2) {
      p2 = { x: p2.width, y: p2.height };
    }
    return {
      x: p2.x + p1.x,
      y: p2.y + p1.y
    };
  }

  /**
   * 自定义减法 p1-p2 或 { p1.x - p2, p1.y - p2}
   * @param p1 1
   * @param p2 2
   */
  public static customSubtract(
    p1: Point | { width: number; height: number },
    p2: Point | { width: number; height: number } | number
  ): Point {
    if ('width' in p1) {
      p1 = { x: p1.width, y: p1.height };
    }
    if (isNumber(p2)) {
      p2 = { x: p2, y: p2 };
    } else {
      if ('width' in p2) {
        p2 = { x: p2.width, y: p2.height };
      }
    }
    return {
      x: p1.x - p2.x,
      y: p1.y - p2.y
    };
  }

  /**
   * 自定义乘法 { p1.x * p2.x, p1.y * p2.y }，p2为标量时就是正常的乘法运算
   * @param p1 1
   * @param p2 2
   */
  public static customMultiply(
    p1: Point | { width: number; height: number },
    p2: Point | { width: number; height: number } | number
  ): Point {
    if ('width' in p1) {
      p1 = { x: p1.width, y: p1.height };
    }
    if (isNumber(p2)) {
      p2 = { x: p2, y: p2 };
    } else {
      if ('width' in p2) {
        p2 = { x: p2.width, y: p2.height };
      }
    }

    return {
      x: p2.x * p1.x,
      y: p2.y * p1.y
    };
  }

  /**
   * 自定义除法，{p1.x / p2.x, p1.y / p2.y}
   * @param p1 1
   * @param p2 2
   */
  public static customDivide(
    p1: Point | { width: number; height: number },
    p2: Point | { width: number; height: number } | number
  ): Point {
    if ('width' in p1) {
      p1 = { x: p1.width, y: p1.height };
    }
    if (isNumber(p2)) {
      p2 = { x: p2, y: p2 };
    } else {
      if ('width' in p2) {
        p2 = { x: p2.width, y: p2.height };
      }
    }
    if (p2.x === 0 || p1.y === 0) {
      console.error(`除法运算中除数为 0 `);
      throw Error('除数不能为 0 ！');
    } else {
      return {
        x: p1.x / p2.x,
        y: p1.y / p2.y
      };
    }
  }

  /**
   * 求两点距离，不输入 p2 代表求点到坐标原点距离
   * @param p1 1
   * @param p2 2
   * @param returnSquare true = 返回距离的平方值
   */
  public static customLength(
    p1: Point | { width: number; height: number },
    p2: Point | { width: number; height: number } = { x: 0, y: 0 },
    returnSquare = true
  ): number {
    if ('width' in p1) {
      p1 = { x: p1.width, y: p1.height };
    }

    if ('width' in p2) {
      p2 = { x: p2.width, y: p2.height };
    }
    const x = p1.x - p2.x;
    const y = p1.y - p2.y;
    let length = x * x + y * y;
    if (!returnSquare) {
      length = Math.sqrt(length);
    }
    return length;
  }

  /**
   * 根据鼠标坐标生成单次擦除轨迹坐标集
   * @param pointer 鼠标坐标
   * @param size 擦除区域的边长
   * @param firstIn 判断是不是起点
   */
  public static generateDataOfSingleErase(
    pointer: Vector2d | null | undefined,
    size: number,
    firstIn = false
  ): string {
    // 由于采用 非0渲染 规则，这里需要确保图案绘制始终保存逆时针方向
    const layerCoord = DrawingCanvasHelper.convertStageToLayerCoord(
      pointer ?? { x: 0, y: 0 }
    );
    const halfSize = size / 2;
    const positiveX =
      halfSize * (layerCoord.x > DrawingCanvasHelper.lastPoint.x ? 1 : -1);
    const positiveY =
      halfSize * (layerCoord.y > DrawingCanvasHelper.lastPoint.y ? 1 : -1);
    let p1: Point;
    let p2: Point;
    let p3: Point;
    let p4: Point;
    let p5: Point;
    let p6: Point;
    if (firstIn) {
      p1 = { x: layerCoord.x - halfSize, y: layerCoord.y - halfSize };
      p2 = { x: layerCoord.x - halfSize, y: layerCoord.y + halfSize };
      p3 = { x: layerCoord.x + halfSize, y: layerCoord.y + halfSize };
      p4 = { x: layerCoord.x + halfSize, y: layerCoord.y - halfSize };
      DrawingCanvasHelper.lastPoint = layerCoord;
      return `M${p1.x},${p1.y} L${p2.x},${p2.y} L${p3.x},${p3.y} L${p4.x},${p4.y}ZM${p1.x},${p1.y} L${p2.x},${p2.y} L${p3.x},${p3.y} L${p4.x},${p4.y}Z`;
    } else {
      p1 = {
        x: DrawingCanvasHelper.lastPoint.x + positiveX,
        y: DrawingCanvasHelper.lastPoint.y + positiveY
      };
      p2 = {
        x: DrawingCanvasHelper.lastPoint.x - positiveX,
        y: DrawingCanvasHelper.lastPoint.y + positiveY
      };
      p3 = { x: layerCoord.x - positiveX, y: layerCoord.y + positiveY };
      p4 = { x: layerCoord.x + positiveX, y: layerCoord.y + positiveY };
      p5 = { x: layerCoord.x + positiveX, y: layerCoord.y - positiveY };
      p6 = {
        x: DrawingCanvasHelper.lastPoint.x + positiveX,
        y: DrawingCanvasHelper.lastPoint.y - positiveY
      };
      // 对于顺时针图案进行反向
      if (positiveX * positiveY > 0) {
        let temp = p2;
        p2 = p6;
        p6 = temp;
        temp = p3;
        p3 = p5;
        p5 = temp;
      }
      DrawingCanvasHelper.lastPoint = layerCoord;
      return `M${p1.x},${p1.y} L${p2.x},${p2.y} L${p3.x},${p3.y} L${p4.x},${p4.y} L${p5.x},${p5.y} L${p6.x},${p6.y}Z`;
    }
  }

  /**
   * 合并擦除轨迹
   * @param datas path 当前的点集
   * @param pointer 鼠标坐标
   * @param size 擦除区域的边长
   */
  public static combineDataOfErase(
    datas: string,
    pointer: Vector2d | null | undefined,
    size: number
  ): string {
    const newData = DrawingCanvasHelper.generateDataOfSingleErase(
      pointer,
      size
    );
    // const poly1 =
    //   // polygon format
    //   {
    //     regions: [
    //       // list of regions
    //       // each region is a list of points
    //       [
    //         [50, 50],
    //         [150, 150],
    //         [190, 50]
    //       ],
    //       [
    //         [130, 50],
    //         [290, 150],
    //         [290, 50]
    //       ]
    //     ],
    //     inverted: false // is this polygon inverted?
    //   };
    // const poly2 =
    //   // polygon format
    //   {
    //     regions: [
    //       // list of regions
    //       // each region is a list of points
    //       [
    //         [150, 150],
    //         [150, 290],
    //         [290, 290],
    //         [290, 150]
    //       ]
    //     ],
    //     inverted: false // is this polygon inverted?
    //   };
    // const a = DrawingCanvasHelper.PolyBool;
    // const unionData = DrawingCanvasHelper.PolyBool.union(poly2, poly1);
    // console.log(unionData);
    // debugger;
    const unionData = newData + datas;
    return unionData;
  }
}
/**
 * 绘图辅助工具
 */
export default function useHelper() {
  return DrawingCanvasHelper;
}

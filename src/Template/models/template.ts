import type { Point } from './vision';
import { getEmptyParam, type Param } from './algorithm';

// 模板
export interface Template {
  // 模板ID
  id: number;
  // 模板名
  name: string;
  // 关联的相机ID
  cameraId: number;
  // 模板图片(base64)
  templateImage: string;
  // 掩膜图片(base64)
  maskImage: string;
  // 背景图片
  backgroundImage: string;
  // 用户重新标注的中心点坐标
  concern: Point;
  // 算法参数
  algParam: Param;
  // 算法参数是否使用全局
  isAlgParamGlobal: boolean;
  // 轨迹文件
  rsfFile: string;
  // 建模区点集
  modelingArea: Point[];
}

export interface ListTemplateResponse {
  rows: Template[];
}

export interface GetTemplateResponse {
  template: Template;
}

export interface GetFeaturePointsResponse {
  rows: Point[];
}

export interface CreateOrUpdateTemplateResponse {
  template: Template;

  isAlgorithmSuccess: boolean;

  algorithmMessage: string;
}

export const getEmptyTemplate = (assignID?: number) => {
  const template: Template = {
    id: assignID ?? 0,
    name: '',
    cameraId: 0,
    templateImage: '',
    maskImage: '',
    backgroundImage: '',
    concern: { x: 0, y: 0 },
    algParam: getEmptyParam(),
    isAlgParamGlobal: true,
    rsfFile: '',
    modelingArea: []
  };
  return template;
};

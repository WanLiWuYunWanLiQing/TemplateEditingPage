// 全局参数
export interface Param {
  // 模板特征点个数
  tSampleFeatureCnt: number;
  // 示教强度，低于此强度忽略
  tTeachGradTh: number;
  // 模板特征点最小间隔
  tSampleFeatureDistance: number;
  // 示教起始角度
  tTeachStartAng: number;
  // 示教角度步长
  tTeachAngleStep: number;
  // 示教角度个数
  tTeachAngleCnt: number;
  // 查找最低分数
  mMatchCollectTh: number;
  // 查找重定位标准
  mMatchRefineTh: number;
  // 查找强度，低于此强度忽略
  mMatchGradTh: number;
  // 最大匹配结果数量，超过则丢弃
  mMaxResultCnt: number;
  // 特征大小
  tFeatureSize: number;
  // 特征线的最短长度，特征线太短，则丢弃该特征线
  tTeachFealineMin: number;
}

export enum FeatureType {
  UNKNOWN = 0, // 无用
  START = 1, // 开始点
  MID = 2, // 中间点
  END = 3 // 结束点
}

// 特征点
export interface Feature {
  // 特征点坐标x
  x: number;
  // 特征点坐标y
  y: number;
  // 特征点类型
  type: FeatureType[];
}

export interface GetAlgParamResponse {
  param: Param;
}

export interface UpdateAlgParamResponse {
  param: Param;
}

export const getEmptyParam = (assignParam?: Param) => {
  const param: Param = {
    tSampleFeatureCnt: assignParam?.tSampleFeatureCnt ?? 0,
    tTeachGradTh: assignParam?.tTeachGradTh ?? 0,
    tSampleFeatureDistance: assignParam?.tSampleFeatureDistance ?? 0,
    tTeachStartAng: assignParam?.tTeachStartAng ?? 0,
    tTeachAngleStep: assignParam?.tTeachAngleStep ?? 0,
    tTeachAngleCnt: assignParam?.tTeachAngleCnt ?? 0,
    mMatchCollectTh: assignParam?.mMatchCollectTh ?? 0,
    mMatchRefineTh: assignParam?.mMatchRefineTh ?? 0,
    mMatchGradTh: assignParam?.mMatchGradTh ?? 0,
    mMaxResultCnt: assignParam?.mMaxResultCnt ?? 0,
    tFeatureSize: assignParam?.tFeatureSize ?? 0,
    tTeachFealineMin: assignParam?.tTeachFealineMin ?? 0
  };
  return param;
};

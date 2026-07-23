using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Rheem.Rysnova.RevitPlugin.Models;

namespace Rheem.Rysnova.RevitPlugin.Services
{
    /// <summary>
    /// 双向同步差异计算引擎
    /// 三路合并算法：base + local + remote -> merged
    /// </summary>
    public static class SyncDiffEngine
    {
        /// <summary>
        /// 比较本地和平台版本，生成同步差异
        /// </summary>
        public static SyncDiff Compare(BIMProject local, BIMProject platform)
        {
            var diff = new SyncDiff();
            
            var localById = local.Devices.ToDictionary(d => d.RysnovaId ?? d.Id);
            var platformById = platform.Devices.ToDictionary(d => d.Id);
            
            var allIds = new HashSet<string>(localById.Keys);
            allIds.UnionWith(platformById.Keys);
            
            foreach (var id in allIds)
            {
                bool inLocal = localById.ContainsKey(id);
                bool inPlatform = platformById.ContainsKey(id);
                
                if (inLocal && !inPlatform)
                {
                    // 本地新增
                    diff.LocalAdded.Add(localById[id]);
                }
                else if (!inLocal && inPlatform)
                {
                    // 平台新增
                    diff.PlatformAdded.Add(platformById[id]);
                }
                else if (inLocal && inPlatform)
                {
                    // 两边都有，检查是否修改
                    var local_d = localById[id];
                    var platform_d = platformById[id];
                    
                    var conflicts = DetectConflicts(local_d, platform_d);
                    if (conflicts.Any())
                    {
                        // 有冲突
                        diff.Conflicts.AddRange(conflicts);
                    }
                    else
                    {
                        // 检查时间戳
                        if (local_d.ModifiedAt > platform_d.ModifiedAt)
                            diff.LocalModified.Add(local_d);
                        else if (platform_d.ModifiedAt > local_d.ModifiedAt)
                            diff.PlatformModified.Add(platform_d);
                    }
                }
            }
            
            return diff;
        }
        
        /// <summary>
        /// 检测两个设备之间的字段级冲突
        /// </summary>
        private static List<ConflictItem> DetectConflicts(BIMDevice local, BIMDevice platform)
        {
            var conflicts = new List<ConflictItem>();
            
            // 位置冲突 (>50mm差异视为修改)
            if (PositionDistance(local.Position, platform.Position) > 50)
            {
                conflicts.Add(new ConflictItem
                {
                    DeviceId = local.Id,
                    Field = "Position",
                    LocalValue = local.Position,
                    PlatformValue = platform.Position,
                    Description = $"设备 {local.Name} 位置在Revit和平台上不一致 " +
                                 $"(偏移 {PositionDistance(local.Position, platform.Position):F0}mm)",
                    Resolution = ConflictResolution.UseLocal  // 默认使用本地
                });
            }
            
            // 型号冲突
            if (!string.IsNullOrEmpty(local.Model) && 
                !string.IsNullOrEmpty(platform.Model) &&
                local.Model != platform.Model)
            {
                conflicts.Add(new ConflictItem
                {
                    DeviceId = local.Id,
                    Field = "Model",
                    LocalValue = local.Model,
                    PlatformValue = platform.Model,
                    Description = $"设备 {local.Name} 型号不一致: {local.Model} vs {platform.Model}",
                    Resolution = ConflictResolution.UsePlatform  // 默认使用平台
                });
            }
            
            // 功率冲突
            if (Math.Abs(local.Power - platform.Power) > 0.1)
            {
                conflicts.Add(new ConflictItem
                {
                    DeviceId = local.Id,
                    Field = "Power",
                    LocalValue = local.Power,
                    PlatformValue = platform.Power,
                    Description = $"设备 {local.Name} 功率不一致: {local.Power}kW vs {platform.Power}kW",
                    Resolution = ConflictResolution.UsePlatform
                });
            }
            
            return conflicts;
        }
        
        private static double PositionDistance(Position3D a, Position3D b)
        {
            if (a == null || b == null) return double.MaxValue;
            double dx = a.X - b.X;
            double dy = a.Y - b.Y;
            double dz = a.Z - b.Z;
            return Math.Sqrt(dx * dx + dy * dy + dz * dz);
        }
        
        /// <summary>
        /// 计算设备指纹（用于检测变更）
        /// </summary>
        public static string ComputeChecksum(BIMDevice device)
        {
            var fingerprint = new
            {
                device.Type,
                device.Position,
                device.Model,
                device.Power,
                device.Spec,
                device.Brand
            };
            string json = JsonConvert.SerializeObject(fingerprint);
            using (var md5 = MD5.Create())
            {
                byte[] hash = md5.ComputeHash(Encoding.UTF8.GetBytes(json));
                return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
            }
        }
        
        /// <summary>
        /// 构建增量变更集（用于上传）
        /// </summary>
        public static ChangeSet BuildChangeSet(BIMProject current, BIMProject baseline)
        {
            var changeSet = new ChangeSet { BaseVersion = baseline?.Version ?? 0 };
            
            var baselineById = baseline?.Devices?.ToDictionary(d => d.Id) ?? new Dictionary<string, BIMDevice>();
            var currentIds = new HashSet<string>(current.Devices.Select(d => d.Id));
            
            // 新增和修改
            foreach (var device in current.Devices)
            {
                if (!baselineById.TryGetValue(device.Id, out var baseDevice))
                {
                    changeSet.Added.Add(device);
                }
                else
                {
                    string currentSum = ComputeChecksum(device);
                    string baseSum = ComputeChecksum(baseDevice);
                    if (currentSum != baseSum)
                        changeSet.Modified.Add(device);
                }
            }
            
            // 删除
            foreach (var baseId in baselineById.Keys)
            {
                if (!currentIds.Contains(baseId))
                    changeSet.Removed.Add(baseId);
            }
            
            return changeSet;
        }
    }
}

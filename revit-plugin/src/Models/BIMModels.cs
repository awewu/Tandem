using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace Rheem.Rysnova.RevitPlugin.Models
{
    public class BIMProject
    {
        [JsonProperty("projectId")] public string ProjectId { get; set; }
        [JsonProperty("projectName")] public string ProjectName { get; set; }
        [JsonProperty("buildingInfo")] public BuildingInfo BuildingInfo { get; set; }
        [JsonProperty("devices")] public List<BIMDevice> Devices { get; set; } = new List<BIMDevice>();
        [JsonProperty("pipes")] public List<BIMPipe> Pipes { get; set; } = new List<BIMPipe>();
        [JsonProperty("ducts")] public List<BIMDuct> Ducts { get; set; } = new List<BIMDuct>();
        [JsonProperty("exportTimestamp")] public DateTime ExportTimestamp { get; set; }
        [JsonProperty("revitVersion")] public string RevitVersion { get; set; }
        [JsonProperty("version")] public int Version { get; set; }
    }
    
    public class BuildingInfo
    {
        [JsonProperty("name")] public string Name { get; set; }
        [JsonProperty("number")] public string Number { get; set; }
        [JsonProperty("address")] public string Address { get; set; }
        [JsonProperty("area")] public double Area { get; set; }
        [JsonProperty("type")] public string Type { get; set; }
    }
    
    public class BIMDevice
    {
        [JsonProperty("id")] public string Id { get; set; }
        [JsonProperty("type")] public string Type { get; set; }
        [JsonProperty("name")] public string Name { get; set; }
        [JsonProperty("position")] public Position3D Position { get; set; }
        [JsonProperty("dimensions")] public Dimensions Dimensions { get; set; }
        [JsonProperty("rotation")] public double Rotation { get; set; }
        [JsonProperty("brand")] public string Brand { get; set; }
        [JsonProperty("model")] public string Model { get; set; }
        [JsonProperty("spec")] public string Spec { get; set; }
        [JsonProperty("power")] public double Power { get; set; }
        [JsonProperty("price")] public double Price { get; set; }
        [JsonProperty("airflow")] public double Airflow { get; set; }
        [JsonProperty("supplyTemp")] public double SupplyTemp { get; set; }
        [JsonProperty("systemType")] public string SystemType { get; set; }
        [JsonProperty("rysnovaBimId")] public string RysnovaId { get; set; }
        [JsonProperty("revitElementId")] public int RevitElementId { get; set; }
        [JsonProperty("modifiedAt")] public DateTime ModifiedAt { get; set; }
        [JsonProperty("checksum")] public string Checksum { get; set; }
    }
    
    public class Position3D
    {
        [JsonProperty("x")] public double X { get; set; }
        [JsonProperty("y")] public double Y { get; set; }
        [JsonProperty("z")] public double Z { get; set; }
    }
    
    public class Dimensions
    {
        [JsonProperty("width")] public double Width { get; set; }
        [JsonProperty("depth")] public double Depth { get; set; }
        [JsonProperty("height")] public double Height { get; set; }
    }
    
    public class BIMPipe
    {
        [JsonProperty("id")] public string Id { get; set; }
        [JsonProperty("type")] public string Type { get; set; }  // pipe / duct
        [JsonProperty("material")] public string Material { get; set; }
        [JsonProperty("diameter")] public double Diameter { get; set; }
        [JsonProperty("path")] public Position3D[] Path { get; set; }
        [JsonProperty("systemType")] public string SystemType { get; set; }
        [JsonProperty("insulation")] public string Insulation { get; set; }
    }
    
    public class BIMDuct
    {
        [JsonProperty("id")] public string Id { get; set; }
        [JsonProperty("width")] public double Width { get; set; }
        [JsonProperty("height")] public double Height { get; set; }
        [JsonProperty("diameter")] public double Diameter { get; set; }
        [JsonProperty("path")] public Position3D[] Path { get; set; }
        [JsonProperty("systemType")] public string SystemType { get; set; }
    }
    
    // ============ 同步相关模型 ============
    
    public class ChangeSet
    {
        [JsonProperty("added")] public List<BIMDevice> Added { get; set; } = new List<BIMDevice>();
        [JsonProperty("modified")] public List<BIMDevice> Modified { get; set; } = new List<BIMDevice>();
        [JsonProperty("removed")] public List<string> Removed { get; set; } = new List<string>();
        [JsonProperty("baseVersion")] public int BaseVersion { get; set; }
    }
    
    public class SyncDiff
    {
        public List<BIMDevice> PlatformAdded { get; set; } = new List<BIMDevice>();
        public List<BIMDevice> PlatformModified { get; set; } = new List<BIMDevice>();
        public List<string> PlatformRemoved { get; set; } = new List<string>();
        public List<BIMDevice> LocalAdded { get; set; } = new List<BIMDevice>();
        public List<BIMDevice> LocalModified { get; set; } = new List<BIMDevice>();
        public List<string> LocalRemoved { get; set; } = new List<string>();
        public List<ConflictItem> Conflicts { get; set; } = new List<ConflictItem>();
    }
    
    public class ConflictItem
    {
        public string DeviceId { get; set; }
        public string Field { get; set; }
        public object PlatformValue { get; set; }
        public object LocalValue { get; set; }
        public string Description { get; set; }
        public ConflictResolution Resolution { get; set; }
    }
    
    public enum ConflictResolution
    {
        UsePlatform,
        UseLocal,
        Merge,
        Skip
    }
    
    public class SyncResult
    {
        [JsonProperty("success")] public bool Success { get; set; }
        [JsonProperty("newVersion")] public int NewVersion { get; set; }
        [JsonProperty("uploadedCount")] public int UploadedCount { get; set; }
    }
    
    public class SyncReport
    {
        public int DevicesAdded { get; set; }
        public int DevicesUpdated { get; set; }
        public int DevicesRemoved { get; set; }
        public int UploadedChanges { get; set; }
        public List<ConflictItem> Conflicts { get; set; } = new List<ConflictItem>();
    }
    
    // ============ API响应模型 ============
    
    public class ProjectSummary
    {
        [JsonProperty("id")] public string Id { get; set; }
        [JsonProperty("name")] public string Name { get; set; }
        [JsonProperty("buildingArea")] public double BuildingArea { get; set; }
        [JsonProperty("deviceCount")] public int DeviceCount { get; set; }
        [JsonProperty("createdAt")] public DateTime CreatedAt { get; set; }
        [JsonProperty("modifiedAt")] public DateTime ModifiedAt { get; set; }
    }
    
    public class UploadResult
    {
        [JsonProperty("success")] public bool Success { get; set; }
        [JsonProperty("projectId")] public string ProjectId { get; set; }
        [JsonProperty("projectUrl")] public string ProjectUrl { get; set; }
        [JsonProperty("version")] public int Version { get; set; }
        [JsonProperty("errorMessage")] public string ErrorMessage { get; set; }
    }
    
    public class ClashReport
    {
        [JsonProperty("hard")] public List<ClashItem> Hard { get; set; }
        [JsonProperty("soft")] public List<ClashItem> Soft { get; set; }
        [JsonProperty("clearance")] public List<ClashItem> Clearance { get; set; }
        [JsonProperty("total")] public int Total { get; set; }
    }
    
    public class ClashItem
    {
        [JsonProperty("type")] public string Type { get; set; }
        [JsonProperty("severity")] public string Severity { get; set; }
        [JsonProperty("suggestion")] public string Suggestion { get; set; }
    }
    
    public class CFDResult
    {
        [JsonProperty("simulationId")] public string SimulationId { get; set; }
        [JsonProperty("comfort")] public ComfortResult Comfort { get; set; }
        [JsonProperty("qualityScore")] public QualityScore QualityScore { get; set; }
        [JsonProperty("recommendations")] public List<object> Recommendations { get; set; }
    }
    
    public class ComfortResult
    {
        [JsonProperty("avgPMV")] public double AvgPMV { get; set; }
        [JsonProperty("avgPPD")] public double AvgPPD { get; set; }
    }
    
    public class QualityScore
    {
        [JsonProperty("score")] public int Score { get; set; }
        [JsonProperty("grade")] public string Grade { get; set; }
        [JsonProperty("compliance")] public Dictionary<string, string> Compliance { get; set; }
    }
    
    public class RoomConfig
    {
        [JsonProperty("roomDimensions")] public Dimensions RoomDimensions { get; set; }
        [JsonProperty("season")] public string Season { get; set; }
        [JsonProperty("outdoorTemp")] public double OutdoorTemp { get; set; }
        [JsonProperty("indoorTargetTemp")] public double IndoorTargetTemp { get; set; }
        [JsonProperty("occupancy")] public int Occupancy { get; set; }
    }
    
    public class BillOfQuantities
    {
        [JsonProperty("totalCost")] public double TotalCost { get; set; }
        [JsonProperty("itemCount")] public int ItemCount { get; set; }
    }
}

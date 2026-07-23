using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Mechanical;
using Autodesk.Revit.DB.Plumbing;
using Autodesk.Revit.UI;
using Rheem.Rysnova.RevitPlugin.Models;
using Rheem.Rysnova.RevitPlugin.Services;

namespace Rheem.Rysnova.RevitPlugin.Commands
{
    /// <summary>
    /// 将Revit模型导出到瑞美HVAC AI平台
    /// </summary>
    [Transaction(TransactionMode.ReadOnly)]
    public class ExportBIMCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            UIDocument uidoc = commandData.Application.ActiveUIDocument;
            Document doc = uidoc.Document;
            
            try
            {
                // 1. 收集所有HVAC设备和管道
                var devices = CollectDevices(doc);
                var pipes = CollectPipes(doc);
                var ducts = CollectDucts(doc);
                
                if (!devices.Any() && !pipes.Any() && !ducts.Any())
                {
                    TaskDialog.Show("Rysnova BIM", "当前模型无可导出的暖通设备/管道");
                    return Result.Cancelled;
                }
                
                // 2. 显示确认对话框
                var dialog = new TaskDialog("导出到Rysnova平台")
                {
                    MainContent = $"将导出以下内容到瑞美平台:\n" +
                                 $"• 设备: {devices.Count} 个\n" +
                                 $"• 水管: {pipes.Count} 段\n" +
                                 $"• 风管: {ducts.Count} 段\n\n" +
                                 $"是否继续？",
                    CommonButtons = TaskDialogCommonButtons.Yes | TaskDialogCommonButtons.No
                };
                
                if (dialog.Show() != TaskDialogResult.Yes)
                    return Result.Cancelled;
                
                // 3. 构建导出数据
                var bimProject = new BIMProject
                {
                    ProjectId = doc.ProjectInformation.UniqueId,
                    ProjectName = doc.Title,
                    Devices = devices,
                    Pipes = pipes,
                    Ducts = ducts,
                    BuildingInfo = new BuildingInfo
                    {
                        Name = doc.ProjectInformation.Name,
                        Number = doc.ProjectInformation.Number,
                        Address = doc.ProjectInformation.Address
                    },
                    ExportTimestamp = DateTime.Now,
                    RevitVersion = doc.Application.VersionNumber
                };
                
                // 4. 上传到平台
                var apiClient = new RysnovaAPIClient();
                var progress = new UI.ProgressDialog("正在上传到平台...");
                progress.Show();
                
                var result = apiClient.UploadProject(bimProject);
                progress.Close();
                
                if (result.Success)
                {
                    var report = new TaskDialog("导出成功")
                    {
                        MainInstruction = "✅ 已成功导出到瑞美平台",
                        MainContent = $"项目ID: {result.ProjectId}\n" +
                                     $"已上传设备: {devices.Count}\n" +
                                     $"平台访问URL:\n{result.ProjectUrl}",
                        CommonButtons = TaskDialogCommonButtons.Ok,
                        FooterText = "<a href=\"" + result.ProjectUrl + "\">在浏览器中打开</a>"
                    };
                    report.Show();
                    return Result.Succeeded;
                }
                else
                {
                    TaskDialog.Show("导出失败", result.ErrorMessage);
                    return Result.Failed;
                }
            }
            catch (Exception ex)
            {
                message = "导出失败: " + ex.Message;
                return Result.Failed;
            }
        }
        
        private List<BIMDevice> CollectDevices(Document doc)
        {
            var collector = new FilteredElementCollector(doc)
                .OfClass(typeof(FamilyInstance))
                .WhereElementIsNotElementType();
            
            // 暖通相关族类别
            var hvacCategories = new HashSet<BuiltInCategory>
            {
                BuiltInCategory.OST_MechanicalEquipment,
                BuiltInCategory.OST_DuctTerminal,
                BuiltInCategory.OST_PlumbingFixtures,
                BuiltInCategory.OST_PipeAccessory,
                BuiltInCategory.OST_DuctAccessory,
                BuiltInCategory.OST_PipeFitting,
                BuiltInCategory.OST_DuctFitting
            };
            
            var devices = new List<BIMDevice>();
            
            foreach (FamilyInstance fi in collector.Cast<FamilyInstance>())
            {
                if (fi.Category == null) continue;
                var bic = (BuiltInCategory)fi.Category.Id.IntegerValue;
                if (!hvacCategories.Contains(bic)) continue;
                
                var location = fi.Location as LocationPoint;
                if (location == null) continue;
                
                XYZ pt = location.Point;
                
                var device = new BIMDevice
                {
                    Id = fi.UniqueId,
                    Name = fi.Symbol.FamilyName,
                    Type = MapCategoryToType(bic),
                    Position = new Position3D
                    {
                        X = pt.X * 304.8,  // ft -> mm
                        Y = pt.Y * 304.8,
                        Z = pt.Z * 304.8
                    },
                    Brand = GetParamString(fi, "Manufacturer"),
                    Model = GetParamString(fi, "Model"),
                    Power = GetParamDouble(fi, "Rysnova_Power"),
                    RysnovaId = GetParamString(fi, "Rysnova_DeviceID"),
                    RevitElementId = fi.Id.IntegerValue
                };
                
                // 提取尺寸
                var bbox = fi.get_BoundingBox(null);
                if (bbox != null)
                {
                    device.Dimensions = new Dimensions
                    {
                        Width = (bbox.Max.X - bbox.Min.X) * 304.8,
                        Depth = (bbox.Max.Y - bbox.Min.Y) * 304.8,
                        Height = (bbox.Max.Z - bbox.Min.Z) * 304.8
                    };
                }
                
                devices.Add(device);
            }
            
            return devices;
        }
        
        private List<BIMPipe> CollectPipes(Document doc)
        {
            var pipes = new List<BIMPipe>();
            var collector = new FilteredElementCollector(doc)
                .OfClass(typeof(Pipe))
                .WhereElementIsNotElementType();
            
            foreach (Pipe pipe in collector.Cast<Pipe>())
            {
                var locCurve = pipe.Location as LocationCurve;
                if (locCurve?.Curve is Line line)
                {
                    pipes.Add(new BIMPipe
                    {
                        Id = pipe.UniqueId,
                        Type = "pipe",
                        Material = GetPipeMaterial(pipe),
                        Diameter = pipe.Diameter * 304.8,
                        Path = new[]
                        {
                            new Position3D { X = line.GetEndPoint(0).X * 304.8, Y = line.GetEndPoint(0).Y * 304.8, Z = line.GetEndPoint(0).Z * 304.8 },
                            new Position3D { X = line.GetEndPoint(1).X * 304.8, Y = line.GetEndPoint(1).Y * 304.8, Z = line.GetEndPoint(1).Z * 304.8 }
                        },
                        SystemType = pipe.MEPSystem?.Name ?? "unknown"
                    });
                }
            }
            return pipes;
        }
        
        private List<BIMDuct> CollectDucts(Document doc)
        {
            var ducts = new List<BIMDuct>();
            var collector = new FilteredElementCollector(doc)
                .OfClass(typeof(Duct))
                .WhereElementIsNotElementType();
            
            foreach (Duct duct in collector.Cast<Duct>())
            {
                var locCurve = duct.Location as LocationCurve;
                if (locCurve?.Curve is Line line)
                {
                    ducts.Add(new BIMDuct
                    {
                        Id = duct.UniqueId,
                        Width = duct.Width * 304.8,
                        Height = duct.Height * 304.8,
                        Diameter = duct.Diameter * 304.8,
                        Path = new[]
                        {
                            new Position3D { X = line.GetEndPoint(0).X * 304.8, Y = line.GetEndPoint(0).Y * 304.8, Z = line.GetEndPoint(0).Z * 304.8 },
                            new Position3D { X = line.GetEndPoint(1).X * 304.8, Y = line.GetEndPoint(1).Y * 304.8, Z = line.GetEndPoint(1).Z * 304.8 }
                        },
                        SystemType = duct.MEPSystem?.Name ?? "unknown"
                    });
                }
            }
            return ducts;
        }
        
        private string MapCategoryToType(BuiltInCategory bic)
        {
            switch (bic)
            {
                case BuiltInCategory.OST_MechanicalEquipment: return "ac-outdoor";
                case BuiltInCategory.OST_DuctTerminal: return "fresh-outlet";
                case BuiltInCategory.OST_PlumbingFixtures: return "water-fixture";
                case BuiltInCategory.OST_PipeAccessory: return "pipe-accessory";
                case BuiltInCategory.OST_DuctAccessory: return "duct-accessory";
                default: return "unknown";
            }
        }
        
        private string GetPipeMaterial(Pipe pipe)
        {
            try
            {
                var pipeType = pipe.PipeType;
                return pipeType?.Name ?? "PPR";
            }
            catch { return "PPR"; }
        }
        
        private string GetParamString(Element elem, string name)
        {
            try { return elem.LookupParameter(name)?.AsString() ?? ""; }
            catch { return ""; }
        }
        
        private double GetParamDouble(Element elem, string name)
        {
            try
            {
                var p = elem.LookupParameter(name);
                return p != null ? p.AsDouble() : 0;
            }
            catch { return 0; }
        }
    }
}

const scale=[[80,'A+',4],[75,'A',3.75],[70,'A-',3.5],[65,'B+',3.25],[60,'B',3],[55,'B-',2.75],[50,'C+',2.5],[45,'C',2.25],[40,'D',2],[0,'F',0]];
function gradeFor(marks){if(typeof marks!=='number'||!Number.isFinite(marks)||marks<0||marks>100)throw new Error('Marks must be between 0 and 100.');const [,letterGrade,gradePoint]=scale.find(([minimum])=>marks>=minimum);return {letterGrade,gradePoint};}
module.exports={gradeFor};

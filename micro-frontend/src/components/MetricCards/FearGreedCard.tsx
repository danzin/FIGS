
// import Brain, { Icon } from 'lucide-react'

// type FearGreedIndicator = {
//   value: number | null;
//   label: string;
// }
// export const FearGreedCard: React.FC<{ indicator?: FearGreedIndicator  }> = ({ indicator }) => {

//   type Sentiment = {
//     label: string;
//     color: string;
//     width: string;
//   }


//     const value = indicator?.value;
//     if (value === null) {
//       console.error('FearGreedCard: Indicator value is null');
//       return;
//     };
//     const getSentiment = (val?: number): Sentiment  => {
//         if (typeof val !== 'number') return { label: 'Neutral', color: 'bg-gray-500', width: '50%' };
//         if (val < 25) return { label: 'Extreme Fear', color: 'bg-red-500', width: '15%' };
//         if (val < 45) return { label: 'Fear', color: 'bg-yellow-500', width: '35%' };
//         if (val < 55) return { label: 'Neutral', color: 'bg-gray-400', width: '50%' };
//         if (val < 75) return { label: 'Greed', color: 'bg-green-400', width: '65%' };
//         return { label: 'Extreme Greed', color: 'bg-green-600', width: '85%' };
//     };
//     const sentiment = getSentiment(value);
    
//     return (
//       <div className=" bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 flex-1 flex flex-col h-40">
//         <Icon className={`h-5 w-5 ${
//           label.includes('Extreme') ? 'bg-red-500' :
//           label.includes('Fear') ? 'bg-red-500' :
//           label.includes('Neutral') ? 'bg-gray-400' :
//           label.includes('Greed') ? 'bg-green-600' :
//           'text-gray-600'
//         }`} />   

//       <div className="flex justify-between items-start">
//             <span className="text-sm text-gray-400">Fear & Greed Index</span>
   
//           </div>
//           <div className="mt-2 text-3xl font-bold">{typeof value === 'number' ? value : '--'}</div>
//           <div className="mt-2">
//             <div className="w-full bg-gray-700 rounded-full h-2">
//               <div className={`${sentiment.color} h-2 rounded-full`} style={{ width: sentiment.width }}></div>
//             </div>
//             <div className="text-center text-sm font-semibold mt-1">{sentiment.label}</div>
//           </div>
//       </div>
//     );
// };
export default async function handler(req, res) {
  const { summonerName, tagLine } = req.query;
  const API_KEY = process.env.RIOT_API_KEY;

  try {
    const accountRes = await fetch(`https://asia.api.riotgames.com/riot/account/v1/accounts/by-game-name/${encodeURIComponent(summonerName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    if (!puuid) throw new Error('소환사 찾기 실패');

    const summonerRes = await fetch(`https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${API_KEY}`);
    const summonerData = await summonerRes.json();
    const id = summonerData.id;

    const leagueRes = await fetch(`https://kr.api.riotgames.com/lol/league/v4/entries/by-summoner/${id}?api_key=${API_KEY}`);
    const leagueData = await leagueRes.json();
    
    const soloRank = leagueData.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
    
    // [유니] 승패 정보 추가!
    const tierInfo = soloRank ? `${soloRank.tier} ${soloRank.rank}` : "UNRANKED";
    const record = soloRank ? `${soloRank.wins}승 ${soloRank.losses}패` : "";

    // 실시간 게임 정보 (게임 중이 아니면 404가 뜨겠지만, 승패 정보는 먼저 보내줄게!)
    const gameRes = await fetch(`https://kr.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}?api_key=${API_KEY}`);
    const gameData = await gameRes.json();

    res.status(200).json({ ...gameData, puuid, tier: tierInfo, record: record });
  } catch (error) {
    // [유니] 게임 중이 아닐 때도 승패 정보는 보여주고 싶어서 에러 핸들링을 살짝 바꿨어!
    res.status(200).json({ error: 'not_in_game', tier: error.tier || "정보 없음", record: error.record || "" });
  }
}
